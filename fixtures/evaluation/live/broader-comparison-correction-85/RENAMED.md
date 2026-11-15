# Renamed file

`manifest.prior.json` was committed as `manifest.json`. It sat next to `MANIFEST.json`, and the two names collide on case-insensitive filesystems such as macOS, so it was renamed. Its content is byte-identical (SHA-256 `fd7b1fc73d1743f9749629268f30766711160703b95a40f9549420746988a48e`). `SHA256SUMS` lists the new name. The `manifest.json` entry inside `MANIFEST.json` refers to this file. `MANIFEST.json` itself was left unchanged because other sealed archives record its hash.
