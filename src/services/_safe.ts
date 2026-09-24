/** Keep the old "log and return a fallback" behaviour the screens were built around. */
export const safe = async <T>(p: Promise<T>, fallback: T, what: string): Promise<T> => {
  try {
    return await p;
  } catch (error) {
    console.error(`Error ${what}:`, error);
    return fallback;
  }
};
