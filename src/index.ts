import path from 'path'

import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { readModule } from './module';
import { readPreset } from './preset';
import { CharXReader, readPng } from './charx';


export async function risumToJson(filePath: string) {
    let data = readFileSync(filePath)
    let risuModule = await readModule(data)

    const targetJsonFilePath = path.format({
        dir: path.dirname(path.dirname(__filename)),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    })

    writeFileSync(targetJsonFilePath, JSON.stringify(risuModule, null, 4))
}


export async function risupToJson(filePath: string) {
    let data = readFileSync(filePath)
    let risuPreset = await readPreset({name: path.basename(filePath), data: data})

    const targetJsonFilePath = path.format({
        dir: path.dirname(path.dirname(__filename)),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    })

    writeFileSync(targetJsonFilePath, JSON.stringify(risuPreset, null, 4))
}


export async function charXToJson(filePath: string) {
    let data = readFileSync(filePath)

    const targetJsonFilePath = path.format({
        dir: path.dirname(path.dirname(__filename)),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    });

    if(filePath.endsWith('charx') || filePath.endsWith('jpg') || filePath.endsWith('jpeg')){
        const reader = new CharXReader()
        await reader.read(data)


        let risuModule = null

        if (reader.moduleData) {
            risuModule = await readModule(Buffer.from(reader.moduleData))
        }

        writeFileSync(targetJsonFilePath, JSON.stringify({
            module: risuModule,
            cardData: JSON.parse(reader.cardData ?? ''),
        }, null, 4))
    }

    if (!filePath.endsWith('png')) {
        throw Error('noData');
    }

    let charaData = await readPng(data);

    writeFileSync(targetJsonFilePath, JSON.stringify(charaData, null, 4))
}

async function beautifyMarkdownText(original: string) {
    let text = original
    text = text.replace(/</g, '\\<').replace(/>/g, '\\>')
    text = text.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
    text = text.replace(/\n{2,}/g, '\n')
    text = text.replace(/\:\:/g, '\\:\\:')
    text = text.replace(/\-\-\-/g, '\\-\\-\\-')
    text = text.replace(/\`\`\`/g, '\\`\\`\\`')
    text = text.replace(/\n#/g, '\n\\#')
    text = text.replace(/^#/g, '\\#')
    const filePath = "temp.md"
    writeFileSync(filePath, text, 'utf-8')
}

async function toJson(folderPath: string) {
    const fileNameList = readdirSync(folderPath)

    for (const fileName of fileNameList) {
        console.log(`-- ${fileName} --`)
        const extension = path.extname(fileName).toLowerCase();
        const fpath = path.join(folderPath, fileName)

        switch (extension) {
            case '.png':
            case '.charx':
                await charXToJson(fpath)
                break
            
            case '.risupreset':
            case '.risup':
                await risupToJson(fpath)
                break

            case '.risum':
                await risumToJson(fpath)
                break
        }
    }
}

// let t = ""
// beautifyMarkdownText(t)

toJson("Target")
