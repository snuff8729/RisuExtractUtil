import rfdc from 'rfdc'

/**
 * Safe variant of structuredClone for svelte 5 states
 * if structuredClone is not available, it will use JSON.parse(JSON.stringify(data)) instead
*/

const rfdcClone = rfdc({
  circles:false,
})

export function safeStructuredClone<T>(data:T):T{
  try {
      return structuredClone(data)
  } catch (error) {
      return rfdcClone(data)
  }
}