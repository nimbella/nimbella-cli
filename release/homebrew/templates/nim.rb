
class Nim < Formula
  desc "Everything you need to get started with Nimbella"
  homepage "https://docs.nimbella.com/command-summary"
  license "Apache-2.0"
  url "__CLI_DOWNLOAD_URL__"
  sha256 "__CLI_SHA256__"
  depends_on "nimbella/brew/nimbella-node" => "__NODE_VERSION__"

  def install
    inreplace "bin/nim", /^CLIENT_HOME=/, "export NIMBELLA_OCLIF_CLIENT_HOME=#{lib/"client"}\nCLIENT_HOME="
    inreplace "bin/nim", "\"$DIR/node\"", Formula["nimbella-node"].opt_bin/"node"
    libexec.install Dir["*"]
    bin.install_symlink libexec/"bin/nim"

  end

  test do
    system bin/"nim", "version"
  end
end
