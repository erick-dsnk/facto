import XCTest
@testable import GlassesLab

final class OCRChunkerTests: XCTestCase {
  private func collapsed(_ text: String) -> String {
    text.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }

  private func assertWithinLimit(_ chunks: [String], max: Int = 800, file: StaticString = #filePath, line: UInt = #line) {
    for chunk in chunks {
      XCTAssertLessThanOrEqual(CodePoints.count(chunk), max, file: file, line: line)
      XCTAssertFalse(chunk.isEmpty, file: file, line: line)
      XCTAssertEqual(chunk, chunk.trimmingCharacters(in: .whitespacesAndNewlines), file: file, line: line)
    }
  }

  func testShortTextIsOneTrimmedChunk() {
    let result = OCRChunker.chunk("  The Eiffel Tower opened in 1889.\nIt is in Paris.  ")
    XCTAssertEqual(result.chunks, ["The Eiffel Tower opened in 1889.\nIt is in Paris."])
    XCTAssertEqual(result.droppedCodePoints, 0)
    XCTAssertFalse(result.droppedText)
  }

  func testBlankTextHasNoChunks() {
    XCTAssertEqual(OCRChunker.chunk("").chunks, [])
    XCTAssertEqual(OCRChunker.chunk(" \n\t ").chunks, [])
  }

  func testLongTextSplitsAtSentenceBoundariesAndKeepsEverything() {
    let sentences = (1...30).map { "Sentence number \($0) says the bridge opened in year \(1_900 + $0)." }
    let text = sentences.joined(separator: " ")
    XCTAssertGreaterThan(CodePoints.count(text), 800)

    let result = OCRChunker.chunk(text)
    XCTAssertEqual(result.chunks.count, 3)
    XCTAssertEqual(result.droppedChunkCount, 0)
    assertWithinLimit(result.chunks)
    for chunk in result.chunks {
      XCTAssertTrue(chunk.hasSuffix("."), "chunk must end on a sentence boundary")
      XCTAssertTrue(chunk.hasPrefix("Sentence number"), "chunk must start on a sentence boundary")
    }
    XCTAssertEqual(collapsed(result.chunks.joined(separator: " ")), collapsed(text), "nothing silently truncated")
  }

  /// Finnish letters with decomposed diacritics and flags: fewer Characters than code
  /// points, so a Character-based limit would let oversize chunks through.
  func testNonASCIILimitCountsCodePointsNotCharacters() {
    let decomposed = "Ha\u{0308}meenlinna on kaupunki ja\u{0308}rven rannalla 🇫🇮🇫🇮."
    let sentences = (1...40).map { "Lause \($0) kertoo: \(decomposed)" }
    let text = sentences.joined(separator: " ")
    XCTAssertGreaterThan(CodePoints.count(text) - text.count, 100, "test text must have multi-scalar characters")

    let result = OCRChunker.chunk(text)
    assertWithinLimit(result.chunks)
    // Each sentence must still be whole: the flags and combining marks survive intact.
    for chunk in result.chunks {
      XCTAssertTrue(chunk.hasSuffix("🇫🇮🇫🇮."))
    }
    let sentInPlusDropped = result.chunks.reduce(0) { $0 + CodePoints.count($1) } + result.droppedCodePoints
    XCTAssertLessThanOrEqual(sentInPlusDropped, CodePoints.count(text))
  }

  func testCountsCodePointsAtTheExactLimit() {
    // 400 flags = 800 code points, one Character each pair of scalars.
    let exact = String(repeating: "🇫🇮", count: 400)
    XCTAssertEqual(OCRChunker.chunk(exact).chunks, [exact])
    let over = exact + "🇫🇮"
    let result = OCRChunker.chunk(over)
    XCTAssertEqual(result.chunks.count, 2)
    assertWithinLimit(result.chunks)
    // No flag is split into two regional indicators.
    for chunk in result.chunks {
      XCTAssertEqual(CodePoints.count(chunk) % 2, 0)
      XCTAssertTrue(chunk.allSatisfy { $0 == "🇫🇮" })
    }
  }

  func testSentenceLongerThanLimitIsCutAtTheLastSpace() {
    let words = (1...300).map { "sana\($0)" }
    let text = words.joined(separator: " ") // one sentence, no punctuation, > 800 code points
    let result = OCRChunker.chunk(text)
    XCTAssertGreaterThan(result.chunks.count, 1)
    assertWithinLimit(result.chunks)
    let original = Set(words)
    for chunk in result.chunks {
      for word in chunk.split(separator: " ") {
        XCTAssertTrue(original.contains(String(word)), "word \(word) was cut in half")
      }
    }
    XCTAssertEqual(collapsed(result.chunks.joined(separator: " ")), collapsed(text))
  }

  func testCutsJapaneseWithoutSpacesAtACharacterBoundary() {
    let sentence = String(repeating: "東京は日本の首都です", count: 100) // 1,000 code points, no spaces
    let result = OCRChunker.chunk(sentence + "。")
    assertWithinLimit(result.chunks)
    XCTAssertEqual(result.chunks.joined(), sentence + "。")
  }

  func testMoreThanThreeChunksRecordsTheDroppedTail() {
    let sentence = String(repeating: "x", count: 500) + "."
    let text = Array(repeating: sentence, count: 5).joined(separator: " ")
    let result = OCRChunker.chunk(text)
    XCTAssertEqual(result.chunks.count, 3)
    XCTAssertEqual(result.droppedChunkCount, 2)
    XCTAssertEqual(result.droppedCodePoints, 2 * 501)
    XCTAssertTrue(result.droppedText)
  }

  func testSentencesReassembleToTheInput() {
    let text = "  Dr. Smith paid 3.50 euros. Hyvää päivää! Onko tämä totta?\nKyllä.  "
    XCTAssertEqual(OCRChunker.sentences(in: text).joined(), text)
  }
}
