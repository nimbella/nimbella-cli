
# This file is automatically generated by https://github.com/nimbella/nimbella-cli/blob/master/release/homebrew.js
# Do not update this file directly;
# Please update the template instead:
# https://github.com/nimbella/nimbella-cli/blob/master/release/homebrew/templates/nimbella-node.rb
class NimbellaNode < Formula
    desc "NodeJS dependency for nimbella"
    homepage "https://docs.nimbella.com/command-summary"
    license "Apache-2.0"
    url "__NODE_BIN_URL__"
    version "__NODE_VERSION__"
    sha256 "__NODE_SHA256__"
    keg_only "nimbella-node is only used by Nimbella CLI (nimbella/brew/nimbella), which explicitly requires from Cellar"
  
    def install
      bin.install buildpath/"bin/node"
    end
  
    test do
      output = system bin/"node", "version"
      assert output.strip == "v#{version}"
    end
end
