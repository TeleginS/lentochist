// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "lentochist-fm",
    platforms: [.macOS("26.0")],
    targets: [
        .executableTarget(name: "lentochist-fm", path: "Sources/lentochist-fm"),
    ]
)
