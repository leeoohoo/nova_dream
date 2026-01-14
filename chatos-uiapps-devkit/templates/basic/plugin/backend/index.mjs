export async function createUiAppsBackend(ctx) {
  return {
    methods: {
      async ping(params, runtimeCtx) {
        return {
          ok: true,
          now: new Date().toISOString(),
          pluginId: runtimeCtx?.pluginId || ctx?.pluginId || '',
          params: params ?? null,
        };
      },
    },
  };
}

