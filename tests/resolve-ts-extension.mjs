export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z\d]+(?:\?.*)?$/i.test(specifier)) {
    try { return await nextResolve(`${specifier}.ts`, context) } catch { /* Let Node report the original unresolved specifier. */ }
  }
  return nextResolve(specifier, context)
}
