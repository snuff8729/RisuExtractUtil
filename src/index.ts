import path from 'path'

import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { readModule } from './module';
import { readPreset } from './preset';
import { CharXReader } from './charx';


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
    const reader = new CharXReader()
    await reader.read(data)

    const targetJsonFilePath = path.format({
        dir: path.dirname(path.dirname(__filename)),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    })

    let risuModule = null

    if (reader.moduleData) {
        risuModule = await readModule(Buffer.from(reader.moduleData))
    }

    writeFileSync(targetJsonFilePath, JSON.stringify({
        module: risuModule,
        cardData: JSON.parse(reader.cardData ?? ''),
    }, null, 4))
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

async function toJson(index: number) {
    const folderPath = "Target"
    const fileNameList = readdirSync(folderPath)
    const fileName = fileNameList[index]

    const fpath = path.join(folderPath, fileName)
    // risupToJson(fpath)
    // risumToJson(fpath)
    charXToJson(fpath)
}

// let t = "Generate <user>'s responses to <char>'s actions and words up to four lines, including <user>'s lines and behavioral descriptions. Follow the format below.\n\nFormat: \n- (The most plausible response of <user> that fits the established narrative and characters)\n- (A response of <user> which can elicit a favorable reaction from <char>)\n- (A response of <user> that is likely to cause conflict with <char>)\n- (A completely absurd and silly response of <user> that can baffle <char>)\n\nNow interaction context will be provided.\n"
// beautifyMarkdownText(t)

let index = 0
toJson(index)
