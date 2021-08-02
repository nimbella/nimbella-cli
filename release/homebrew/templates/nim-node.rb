require "language/node"

class NimNode < Formula
  desc "node.js dependency for nimbella"
  homepage "https://docs.nimbella.com/command-summary"
  license "Apache-2.0"
  url "__NODE_BIN_URL__"
  version "__NODE_VERSION__"
  sha256 "__NODE_SHA256__"
  keg_only "nim-node is only used by Nimbella CLI (nimbella/brew/nim), which explicitly requires from Cellar"

  # resource "node" do
  #   url {url}
  #   sha256 {sha256}
  # end

  def install
    bin.install buildpath/"bin/node"
    # buildpath.install resource("node")
  end
  
  def test
    output = system bin/"node", "version"
    assert output.strip == "v#{version}"
  end
end
