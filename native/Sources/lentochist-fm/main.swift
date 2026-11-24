// Native Messaging host that lets the lentochist extension use Apple
// Foundation Models. Chrome starts it via `runtime.connectNative` and talks
// over stdin/stdout: each message is UTF-8 JSON preceded by a 32-bit length
// in native byte order.

import CoreGraphics
import Foundation
import FoundationModels
import ImageIO
import Security

@Generable
struct Judgment {
    @Guide(description: "One entry per statement id, each answered exactly once")
    var answers: [Answer]
}

@Generable
struct Answer {
    var id: String
    @Guide(description: "Probability from 0 to 1 that the statement is true of the tweet", .range(0...1))
    var probability: Double
}

struct Request: Decodable {
    let id: Int
    let kind: String
    /// "system" for the on-device model, "pcc" for Private Cloud Compute.
    let model: String?
    let instructions: String?
    let prompt: String?
    /// Raw base64 JPEG.
    let image: String?
}

// MARK: - Framing

func readMessage() -> Data? {
    let stdin = FileHandle.standardInput
    guard let header = try? stdin.read(upToCount: 4), header.count == 4 else { return nil }
    let length = header.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
    guard let body = try? stdin.read(upToCount: Int(length)), body.count == Int(length) else { return nil }
    return body
}

func send(_ object: [String: Any]) {
    guard let body = try? JSONSerialization.data(withJSONObject: object) else { return }
    var length = UInt32(body.count)
    let header = Data(bytes: &length, count: 4)
    FileHandle.standardOutput.write(header + body)
}

// MARK: - Model

func imagesSupported() -> Bool {
    if #available(macOS 27.0, *) { return true }
    return false
}

struct HelperError: Error, CustomStringConvertible {
    let description: String
}

func systemStatus() -> [String: Any] {
    switch SystemLanguageModel.default.availability {
    case .available:
        return ["available": true, "images": imagesSupported()]
    case .unavailable(let reason):
        return ["available": false, "images": false, "reason": "\(reason)"]
    }
}

let pccEntitlement = "com.apple.developer.private-cloud-compute"

/// PCC reports itself available even when this binary may not use it; the
/// restricted entitlement is what actually gates requests.
func hasPccEntitlement() -> Bool {
    guard let task = SecTaskCreateFromSelf(nil),
          let value = SecTaskCopyValueForEntitlement(task, pccEntitlement as CFString, nil)
    else { return false }
    return (value as? Bool) == true
}

func pccStatus() -> [String: Any] {
    guard #available(macOS 27.0, *) else {
        return ["available": false, "images": false, "reason": "needs macOS 27"]
    }
    guard hasPccEntitlement() else {
        return ["available": false, "images": false, "reason": "helper is not signed with \(pccEntitlement)", "entitlement": false]
    }
    let model = PrivateCloudComputeLanguageModel()
    switch model.availability {
    case .available:
        if model.quotaUsage.isLimitReached {
            return ["available": false, "images": true, "reason": "quota limit reached", "quota": true]
        }
        return ["available": true, "images": true]
    case .unavailable(let reason):
        return ["available": false, "images": false, "reason": "\(reason)"]
    }
}

func status(id: Int) -> [String: Any] {
    ["id": id, "system": systemStatus(), "pcc": pccStatus()]
}

func makeSession(model: String, instructions: String) throws -> LanguageModelSession {
    if model == "pcc" {
        guard #available(macOS 27.0, *) else { throw HelperError(description: "Private Cloud Compute needs macOS 27") }
        guard hasPccEntitlement() else { throw HelperError(description: "helper is not signed with \(pccEntitlement)") }
        return LanguageModelSession(model: PrivateCloudComputeLanguageModel(), instructions: instructions)
    }
    // Tweets about scams or adult promo are exactly what we classify, so the
    // default guardrails would refuse the very inputs we need judged.
    let system = SystemLanguageModel(guardrails: .permissiveContentTransformations)
    return LanguageModelSession(model: system, instructions: instructions)
}

func cgImage(base64: String) -> CGImage? {
    guard let data = Data(base64Encoded: base64),
          let source = CGImageSourceCreateWithData(data as CFData, nil)
    else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func judge(_ request: Request) async -> [String: Any] {
    guard let prompt = request.prompt else { return ["id": request.id, "error": "missing prompt"] }
    let options = GenerationOptions(temperature: 0)
    do {
        let session = try makeSession(model: request.model ?? "system", instructions: request.instructions ?? "")
        let judgment: Judgment
        if #available(macOS 27.0, *), let base64 = request.image, let image = cgImage(base64: base64) {
            judgment = try await session.respond(generating: Judgment.self, options: options) {
                prompt
                Attachment(image).label("Tweet media")
            }.content
        } else {
            judgment = try await session.respond(to: prompt, generating: Judgment.self, options: options).content
        }
        let answers = judgment.answers.map { ["id": $0.id, "probability": $0.probability] as [String: Any] }
        return ["id": request.id, "answers": answers]
    } catch {
        if #available(macOS 27.0, *),
           let pccError = error as? PrivateCloudComputeLanguageModel.Error,
           case .quotaLimitReached = pccError {
            return ["id": request.id, "error": "Private Cloud Compute quota limit reached", "quota": true]
        }
        return ["id": request.id, "error": "\(error)"]
    }
}

// MARK: - Loop

while let body = readMessage() {
    guard let request = try? JSONDecoder().decode(Request.self, from: body) else {
        send(["id": 0, "error": "bad request"])
        continue
    }
    switch request.kind {
    case "status": send(status(id: request.id))
    case "judge": send(await judge(request))
    default: send(["id": request.id, "error": "unknown kind \(request.kind)"])
    }
}
