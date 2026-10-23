export const stores = new Map<string, Record<string, unknown>>();
export const prisma = {
  store: {
    findUnique: async ({ where }: { where: { id: string } }) => stores.get(where.id) ?? null,
  },
};
