import * as crypto from "crypto"

export async function decryptBuffer(data:Uint8Array, keys:string) {
  // Create a hash of the key to get a fixed length key value
  const hash = crypto.createHash('sha256');
  hash.update(keys);
  const keyArray = hash.digest();

  // In Node.js, we use createCipheriv/createDecipheriv instead of subtle crypto
  // AES-GCM requires a 12-byte IV (initialization vector)
  const iv = Buffer.alloc(12, 0); // Equivalent to new Uint8Array(12)
  
  // Create decipher with key, iv, and algorithm
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyArray, iv);
  
  // When using GCM, you need to set the auth tag which is the last 16 bytes
  // Assuming the format: [ciphertext][16-byte auth tag]
  const authTag = data.slice(data.length - 16);
  const ciphertext = data.slice(0, data.length - 16);
  
  decipher.setAuthTag(authTag);
  
  // Decrypt the data
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted;
}

export function blobToUint8Array(data:Blob){
    return new Promise<Uint8Array>((resolve,reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if(reader.result instanceof ArrayBuffer){
                resolve(new Uint8Array(reader.result))
            }
            else{
                reject(new Error('reader.result is not ArrayBuffer'))
            }
        }
        reader.onerror = () => {
            reject(reader.error)
        }
        reader.readAsArrayBuffer(data)
    })
}

export async function hasher(data:Uint8Array){
    return Buffer.from(await crypto.subtle.digest("SHA-256", data)).toString('hex');
}


// export async function decryptBuffer(data:Uint8Array, keys:string){
//     // hash the key to get a fixed length key value
//     const keyArray = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(keys))

//     const key = await window.crypto.subtle.importKey(
//         "raw",
//         keyArray,
//         "AES-GCM",
//         false,
//         ["encrypt", "decrypt"]
//     )

//     // use web crypto api to encrypt the data
//     const result = await window.crypto.subtle.decrypt(
//         {
//             name: "AES-GCM",
//             iv: new Uint8Array(12),
//         },
//         key,
//         data
//     )

//     return result
// }
