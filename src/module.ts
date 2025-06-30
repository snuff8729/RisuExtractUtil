import { RisuModule } from "./util/type"
import { decodeRPack } from "./rpack/rpack_bg"
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync } from 'fs';

/**
 * Saves an asset file with the given data, custom ID, and file name.
 * 
 * @param {Uint8Array} data - The data of the asset file.
 * @param {string} [customId=''] - The custom ID for the asset file.
 * @param {string} [fileName=''] - The name of the asset file.
 * @returns {Promise<string>} - A promise that resolves to the path of the saved asset file.
 */
export async function saveAsset(data:Uint8Array, fileName:string = ''){
    let id = uuidv4()

    let fileExtension:string = 'png'
    if(fileName && fileName.split('.').length > 0){
        fileExtension = fileName.split('.').pop() || ''
    }

    let form = `assets/${id}.${fileExtension}`
    writeFileSync(form, data)
    return form
}

export async function readModule(buf:Buffer):Promise<RisuModule> {
    let pos = 0

    const readLength = () => {
        const len = buf.readUInt32LE(pos)
        pos += 4
        return len
    }
    const readByte = () => {
        const byte = buf.readUInt8(pos)
        pos += 1
        return byte
    }
    const readData = (len:number) => {
        const data = buf.subarray(pos, pos + len)
        pos += len
        return data
    }

    if(readByte() !== 111){
        throw new Error("Invalid magic number")
    }
    if(readByte() !== 0){ //Version check
        throw new Error("Invalid version")
    }

    const mainLen = readLength()
    const mainData = readData(mainLen)
    const main:{
        type:'risuModule'
        module:RisuModule
    } = JSON.parse(Buffer.from(await decodeRPack(mainData)).toString())

    if(main.type !== 'risuModule'){
        throw new Error("Invalid module type")
    }

    let module = main.module

    let i = 0
    while(true){
        const mark = readByte()
        if(mark === 0){
            break
        }
        if(mark !== 1){
            throw new Error("No data")
        }
        const len = readLength()
        const data = readData(len)
        // await saveAsset(Buffer.from(await decodeRPack(data)))
    }

    return module
}
