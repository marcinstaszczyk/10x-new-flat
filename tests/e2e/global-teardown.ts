import { deleteE2eUser } from "./support/auth";
import { stopDevServer } from "./support/dev-server";

export default async function globalTeardown() {
  await deleteE2eUser();
  await stopDevServer();
}
