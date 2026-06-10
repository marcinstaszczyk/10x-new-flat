import { deleteE2eUser } from "./support/auth";

export default async function globalTeardown() {
  await deleteE2eUser();
}
