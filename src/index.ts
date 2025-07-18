import path from 'path'

import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { readModule } from './module';
import { readPreset } from './preset';
import { CharXReader, readPng } from './charx';


export async function risumToJson(filePath: string, targetFolderPath: string) {
    let data = readFileSync(filePath)
    let risuModule = await readModule(data)

    const targetJsonFilePath = path.format({
        dir: path.join(path.dirname(path.dirname(__filename)), targetFolderPath),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    })

    writeFileSync(targetJsonFilePath, JSON.stringify(risuModule, null, 4))
}


export async function risupToJson(filePath: string, targetFolderPath: string) {
    let data = readFileSync(filePath)
    let risuPreset = await readPreset({name: path.basename(filePath), data: data})

    const targetJsonFilePath = path.format({
        dir: path.join(path.dirname(path.dirname(__filename)), targetFolderPath),
        name: path.basename(filePath, path.extname(filePath)),
        ext: '.json',
    })

    writeFileSync(targetJsonFilePath, JSON.stringify(risuPreset, null, 4))
}


export async function charXToJson(filePath: string, targetFolderPath: string) {
    let data = readFileSync(filePath)

    const targetJsonFilePath = path.format({
        dir: path.join(path.dirname(path.dirname(__filename)), targetFolderPath),
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

async function toJson(folderPath: string, targetFolderPath: string = "Converted") {
    const fileNameList = readdirSync(folderPath)

    for (const fileName of fileNameList) {
        console.log(`-- ${fileName} --`)
        const extension = path.extname(fileName).toLowerCase();
        const fpath = path.join(folderPath, fileName)

        switch (extension) {
            case '.png':
            case '.charx':
                await charXToJson(fpath, targetFolderPath)
                break
            
            case '.risupreset':
            case '.risup':
                await risupToJson(fpath, targetFolderPath)
                break

            case '.risum':
                await risumToJson(fpath, targetFolderPath)
                break
        }
    }
}

async function beautifyMarkdownText(original: string): Promise<string> {
    let text = original
    text = text.replace(/</g, '\\<').replace(/>/g, '\\>')
    text = text.replace(/\[/g, '\\[').replace(/\]/g, '\\]')
    text = text.replace(/\n{2,}/g, '\n')
    text = text.replace(/\:\:/g, '\\:\\:')
    text = text.replace(/\-\-\-/g, '\\-\\-\\-')
    text = text.replace(/\`\`\`/g, '\\`\\`\\`')
    text = text.replace(/\n#/g, '\n\\#')
    text = text.replace(/^#/g, '\\#')
    return text;
}

async function promptTemplateToMarkdown(filePath: string, targetFolderPath: string = "Converted") {
    let rawData = readFileSync(filePath, 'utf8')
    const jsonData = JSON.parse(rawData);

    const promptTemplateData = jsonData.promptTemplate;

    const markdownEntries = await Promise.all(promptTemplateData.map(async (
        item: { name: string; role: string; type: string; type2: string; text: string; }
    ) => {
        const { name, role, type, type2, text } = item;
        const header = `# ${name} ${role} ${type} ${type2}`;
        let markdownString = `${header}`;

        if (text !== undefined) {
            const beautifiedText = await beautifyMarkdownText(text);
            markdownString += `\n\n${beautifiedText}`;
        }

        return markdownString;
    }));

    const parsedPath = path.parse(filePath);
    parsedPath.dir = path.join(path.dirname(path.dirname(__filename)), targetFolderPath);
    parsedPath.ext = '.md'
    parsedPath.base = '';

    writeFileSync(
        path.format(parsedPath), 
        markdownEntries.join('\n\n---\n\n'), 
        'utf-8'
    )
}


// toJson("Source Files")
promptTemplateToMarkdown("Converted/소악마 프롬프트 v6 [Gem2.5]_preset.json")

