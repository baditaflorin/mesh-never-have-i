import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-never-have-i",
  description: "Anonymous 'never have I ever' party game — group sees % guilty per prompt",
  accentHex: "#c850c0",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
