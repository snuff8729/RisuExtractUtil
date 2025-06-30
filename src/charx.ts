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