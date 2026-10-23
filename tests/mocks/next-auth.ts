export const sessionState: { session: unknown } = { session: null };
export async function getServerSession() {
  return sessionState.session;
}
