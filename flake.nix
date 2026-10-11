{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "https://channels.nixos.org/nixpkgs-unstable/nixexprs.tar.zst";
  };

  outputs =
    inputs:
    inputs.flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import inputs.nixpkgs { inherit system; };
      in
      {
        formatter = pkgs.nixfmt;
        devShells.default = pkgs.mkShell {
          # Node 24 runs the TypeScript sources natively (type stripping, no build step).
          packages = with pkgs; [
            nodejs_24
          ];
        };
      }
    );
}
