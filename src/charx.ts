import * as fflate from "fflate"


/**
 * A class to manage a buffer that can be appended to and deappended from.
 */
export class AppendableBuffer {
    buffer: Uint8Array
    deapended: number = 0

    /**
     * Creates an instance of AppendableBuffer.
     */
    constructor() {
        this.buffer = new Uint8Array(0)
    }

    /**
     * Appends data to the buffer.
     * @param {Uint8Array} data - The data to append.
     */
    append(data: Uint8Array) {
        const newBuffer = new Uint8Array(this.buffer.length + data.length)
        newBuffer.set(this.buffer, 0)
        newBuffer.set(data, this.buffer.length)
        this.buffer = newBuffer
    }

    /**
     * Deappends a specified length from the buffer.
     * @param {number} length - The length to deappend.
     */
    deappend(length: number) {
        this.buffer = this.buffer.slice(length)
        this.deapended += length
    }

    /**
     * Slices the buffer from start to end.
     * @param {number} start - The start index.
     * @param {number} end - The end index.
     * @returns {Uint8Array} - The sliced buffer.
     */
    slice(start: number, end: number) {
        return this.buffer.slice(start - this.deapended, end - this.deapended)
    }

    /**
     * Gets the total length of the buffer including deappended length.
     * @returns {number} - The total length.
     */
    length() {
        return this.buffer.length + this.deapended
    }
}


export function sleep(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}


export class CharXReader{
    unzip:fflate.Unzip
    assets:{[key:string]:string} = {}
    assetBuffers:{[key:string]:AppendableBuffer} = {}
    assetPromises:Promise<void>[] = []
    excludedFiles:string[] = []
    cardData:string|undefined
    moduleData:Uint8Array|undefined
    constructor(){
        this.unzip = new fflate.Unzip()
        this.unzip.register(fflate.UnzipInflate)
        this.unzip.onfile = (file) => {
            const assetIndex = file.name
            this.assetBuffers[assetIndex] = new AppendableBuffer()

            file.ondata = (err, dat, final) => {
                this.assetBuffers[assetIndex].append(dat)
                if(final){
                    const assetData = this.assetBuffers[assetIndex].buffer
                    if(assetData.byteLength > 50 * 1024 * 1024){
                        this.excludedFiles.push(assetIndex)
                    }
                    else if(file.name === 'card.json'){
                        this.cardData = new TextDecoder().decode(assetData)
                    }
                    else if(file.name === 'module.risum'){
                        this.moduleData = assetData
                    }
                    else if(file.name.endsWith('.json')){
                        //do nothing
                    }
                    else{
                        // this.assetPromises.push((async () => {
                            // const assetId = await saveAsset(assetData)
                            // this.assets[assetIndex] = assetId
                        // })())
                    }
                }
            }
            
            if(file.originalSize ?? 0 < 50 * 1024 * 1024){
                file.start()
            }
        }
    }

    async push(data:Uint8Array, final:boolean = false){

        if(data.byteLength > 1024 * 1024){
            let pointer = 0
            while(true){
                const chunk = data.slice(pointer, pointer + 1024 * 1024)
                this.unzip.push(chunk, false)
                await Promise.all(this.assetPromises)
                if(pointer + 1024 * 1024 >= data.byteLength){
                    if(final){
                        this.unzip.push(new Uint8Array(0), final)
                    }
                    break
                }
                pointer += 1024 * 1024
            }
            return
        }

        this.unzip.push(data, final)
        await Promise.all(this.assetPromises)
    }

    async read(data:Uint8Array|File|ReadableStream<Uint8Array>, arg:{
        alertInfo?:boolean
    } = {}){

        if(data instanceof ReadableStream){
            const reader = data.getReader()
            while(true){
                const {done, value} = await reader.read()
                if(value){
                    await this.push(value, false)
                }
                if(done){
                    await this.push(new Uint8Array(0), true)
                    break
                }
            }
            await this.push(new Uint8Array(0), true)
            return
        }

        const getSlice = async (start:number, end:number) : Promise<Uint8Array<ArrayBuffer>> => {
            if(data instanceof Uint8Array){
                return data.slice(start, end)
            }
            if(data instanceof File){
                return new Uint8Array(await data.slice(start, end).arrayBuffer())
            }

            throw new Error('Cannot get slice data')
        }

        const getLength = (): number => {
            if(data instanceof Uint8Array){
                return data.byteLength
            }
            if(data instanceof File){
                return data.size
            }
            
            throw new Error('Cannot get length data')
        }

        let pointer = 0
        while(true){
            const chunk = await getSlice(pointer, pointer + 1024 * 1024)
            await this.push(chunk, false)

            const length = getLength()
            if(pointer + 1024 * 1024 >= length){
                await this.push(new Uint8Array(0), true)
                break
            }
            pointer += 1024 * 1024
        }
        await sleep(100)
    }
}


import crc32 from 'crc/crc32';
import { blobToUint8Array } from "./util/util"
import { decryptBuffer, hasher } from "./util/util"
import { RccCardMetaData, OldTavernChar, CharacterCardV2Risu } from "./util/type"


export const PngChunk = {
    read: (data:Uint8Array, chunkName:string[], arg:{checkCrc?:boolean} = {}) => {
        let pos = 8
        let chunks:{[key:string]:string} = {}
        while(pos < data.length){
            const len = data[pos] * 0x1000000 + data[pos+1] * 0x10000 + data[pos+2] * 0x100 + data[pos+3]
            const type = data.slice(pos+4,pos+8)
            const typeString = new TextDecoder().decode(type)
            if(arg.checkCrc){
                const crc = data[pos+8+len] * 0x1000000 + data[pos+9+len] * 0x10000 + data[pos+10+len] * 0x100 + data[pos+11+len]
                const crcCheck = crc32(data.slice(pos+4,pos+8+len))
                if(crc !== crcCheck){
                    throw new Error('crc check failed')
                }
            }
            if(typeString === 'IEND'){
                break
            }
            if(typeString === 'tEXt'){
                const chunkData = data.slice(pos+8,pos+8+len)
                let key=''
                let value=''
                for(let i=0;i<70;i++){
                    if(chunkData[i] === 0){
                        key = new TextDecoder().decode(chunkData.slice(0,i))
                        value = new TextDecoder().decode(chunkData.slice(i + 1))
                        break
                    }
                }
                if(chunkName.includes(key)){
                    chunks[key] = value
                }
            }
            pos += 12 + len
        }
        return chunks
    },

    readGenerator: async function*(data:File|Uint8Array|ReadableStream<Uint8Array>, arg:{checkCrc?:boolean,returnTrimed?:boolean} = {}):AsyncGenerator<
        {key:string,value:string}|AppendableBuffer,null
    >{
        const reader = data instanceof ReadableStream ? data.getReader() : null
        let readableStreamData = new AppendableBuffer()
        const trimedData = new AppendableBuffer()

        async function appendTrimed(data:Uint8Array){
            if(arg.returnTrimed){
                trimedData.append(data)
            }
        }

        async function slice(start:number,end:number):Promise<Uint8Array> {
            if(data instanceof File){
                return await blobToUint8Array (data.slice(start,end))
            }
            else if(data instanceof Uint8Array){
                return data.slice(start,end)
            }
            else{
                while(end > readableStreamData.length()){
                    const rs = await reader!.read()
                    if(!rs.value && rs.done){
                        return new Uint8Array(0)
                    }
                    if(!rs.value){
                        continue
                    }
                    readableStreamData.append(rs.value)
                }
                const data = readableStreamData.slice(start, end)

                if(start - readableStreamData.deapended > 200000){
                    readableStreamData.deappend(50000)
                }

                return data
            }
        }

        

        await appendTrimed(await slice(0,8))
        let pos = 8
        const size = data instanceof File ? data.size : data instanceof Uint8Array ? data.length : Infinity
        while(pos < size){
            const dataPart = await slice(pos,pos+4)
            const len = dataPart[0] * 0x1000000 + dataPart[1] * 0x10000 + dataPart[2] * 0x100 + dataPart[3]
            const type = await slice(pos+4,pos+8)
            const typeString = new TextDecoder().decode(type)
            if(arg.checkCrc && !(data instanceof ReadableStream)){ //crc check is not supported for stream
                const dataPart = await slice(pos+8+len,pos+12+len)
                const crc = dataPart[0] * 0x1000000 + dataPart[1] * 0x10000 + dataPart[2] * 0x100 + dataPart[3]
                const crcCheck = crc32(await slice(pos+4,pos+8+len))
                if(crc !== crcCheck){
                    throw new Error('crc check failed')
                }
            }
            if(typeString === 'IEND'){
                await appendTrimed(await slice(pos,pos+12+len))
                break
            }
            else if(typeString === 'tEXt'){
                const chunkData = await slice(pos+8,pos+8+len)
                let key=''
                let value=''
                for(let i=0;i<70;i++){
                    if(chunkData[i] === 0){
                        key = new TextDecoder().decode(chunkData.slice(0,i))
                        value = new TextDecoder().decode(chunkData.slice(i+1))
                        break
                    }
                }
                yield {key,value}
            }
            else{
                await appendTrimed(await slice(pos,pos+12+len))
            }
            pos += 12 + len
        }
        if(arg.returnTrimed){
            yield trimedData
        }
        return null
    },

    trim: (data:Uint8Array) => {
        let pos = 8
        let newData:Uint8Array[] = []
        while(pos < data.length){
            const len = data[pos] * 0x1000000 + data[pos+1] * 0x10000 + data[pos+2] * 0x100 + data[pos+3]
            const type = data.slice(pos+4,pos+8)
            const typeString = new TextDecoder().decode(type)
            if(typeString === 'IEND'){
                newData.push(data.slice(pos,pos+12+len))
                break
            }
            if(typeString === 'tEXt'){
                pos += 12 + len
            }
            else{
                newData.push(data.slice(pos,pos+12+len))
                pos += 12 + len
            }
        }
        newData.push(data.slice(pos))
        return Buffer.concat(newData)
    },
}


export async function readPng(data:Uint8Array|File|ReadableStream<Uint8Array>, cardPassword?: string) {

    let readedChara = ''
    let readedCCv3 = ''
    let img:Uint8Array
    let pngChunks = 0
    let readedPngChunks = 0

    {
        let readData: Uint8Array|File|ReadableStream<Uint8Array>;

        if(data instanceof ReadableStream){
            const tee = data.tee()
            data = tee[0]
            readData = tee[1]
        }
        else{
            readData = data
        }

        const prereader = PngChunk.readGenerator(readData, {

        })

        for await(const chunk of prereader){
            if(chunk instanceof AppendableBuffer){
                break
            }
            if(chunk.key.startsWith('chara-ext-asset_')){
                pngChunks++
            }
        }
    }

    const readGenerator = PngChunk.readGenerator(data, {
        returnTrimed: true
    })

    for await (const chunk of readGenerator){
        console.log(chunk)
        if(!chunk){
            continue
        }
        if(chunk instanceof AppendableBuffer){
            img = chunk.buffer
            break
        }
        if(chunk.key === 'chara'){
            //For memory reason, limit to 5MB
            if(readedChara.length < 5 * 1024 * 1024){
                readedChara = chunk.value
            }
            continue
        }
        if(chunk.key === 'ccv3'){
            if(readedCCv3.length < 5 * 1024 * 1024){
                readedCCv3 = chunk.value
            }
            continue
        }
        if(chunk.key.startsWith('chara-ext-asset_')){
            break
        }
    }

    if(!readedChara && !readedCCv3){
        throw Error("noData");
    }

    if(readedCCv3){
        readedChara = readedCCv3
    }

    if(readedChara.startsWith('rcc||')){
        const parts = readedChara.split('||')
        const type = parts[1]
        if(type === 'rccv1'){
            if(parts.length !== 5){
                throw Error("noData");
            }
            const encrypted = Buffer.from(parts[2], 'base64')
            const hashed = await hasher(encrypted)
            if(hashed !== parts[3]){
                throw Error("noData");
            }
            const metaData: RccCardMetaData = JSON.parse(Buffer.from(parts[4], 'base64').toString('utf-8'))
            if(metaData.usePassword){
                if(!cardPassword){
                    return
                }
                else{
                    try {
                        const decrypted = await decryptBuffer(encrypted, cardPassword)
                        const charaData: CharacterCardV2Risu = JSON.parse(Buffer.from(decrypted).toString('utf-8'))
                    return charaData
                    } catch (error) {
                        throw Error("wrong Password");
                    }
                }
            }
            else{
                const decrypted = await decryptBuffer(encrypted, 'RISU_NONE')
                try {
                    const charaData:CharacterCardV2Risu = JSON.parse(Buffer.from(decrypted).toString('utf-8'))
                    return charaData
                } catch (error) {
                    throw Error("no Data");
                }
            }

        }
    }
    const parsed = JSON.parse(Buffer.from(readedChara, 'base64').toString('utf-8'))

    //fix readedChara version pointing number instead of string because of previous version
    if(typeof (parsed as CharacterCardV2Risu)?.data?.character_version === 'number'){
        (parsed as CharacterCardV2Risu).data.character_version = (parsed as CharacterCardV2Risu).data.character_version.toString()
    }

    if(parsed.spec !== 'chara_card_v2' && parsed.spec !== 'chara_card_v3'){
        const charaData: OldTavernChar = JSON.parse(Buffer.from(readedChara, 'base64').toString('utf-8'))
        console.log(charaData)
    }

    return parsed;
}