// Native Messaging host that lets the lentochist extension use Apple
// Foundation Models. Chrome starts it via `runtime.connectNative` and talks
// over stdin/stdout: each message is UTF-8 JSON preceded by a 32-bit length
// in native byte order.

import CoreGraphics
import Foundation
import FoundationModels
import ImageIO

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

func status(id: Int) -> [String: Any] {
    switch SystemLanguageModel.default.availability {
    case .available:
        return ["id": id, "available": true, "images": imagesSupported()]
    case .unavailable(let reason):
        return ["id": id, "available": false, "images": false, "reason": "\(reason)"]
    }
}

func cgImage(base64: String) -> CGImage? {
    guard let data = Data(base64Encoded: base64),
          let source = CGImageSourceCreateWithData(data as CFData, nil)
    else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func judge(_ request: Request) async -> [String: Any] {
    guard let prompt = request.prompt else { return ["id": request.id, "error": "missing prompt"] }
    // Tweets about scams or adult promo are exactly what we classify, so the
    // default guardrails would refuse the very inputs we need judged.
    let model = SystemLanguageModel(guardrails: .permissiveContentTransformations)
    let session = LanguageModelSession(model: model, instructions: request.instructions ?? "")
    let options = GenerationOptions(temperature: 0)
    do {
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
