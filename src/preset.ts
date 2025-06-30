import {encode as encodeMsgpack, decode as decodeMsgpack} from "msgpackr"
import * as fflate from "fflate"

import { decodeRPack } from "./rpack/rpack_bg"
import { decryptBuffer } from "./util/util"
import { botPreset, prebuiltPresets } from "./util/templates"
import { safeStructuredClone } from "./util/polyfill"

export const defaultMainPrompt = prebuiltPresets.OAI.mainPrompt
export const defaultJailbreak = prebuiltPresets.OAI.jailbreak

interface AINsettings{
    top_p: number,
    rep_pen: number,
    top_a: number,
    rep_pen_slope:number,
    rep_pen_range: number,
    typical_p:number
    badwords:string
    stoptokens:string
    top_k:number
}

export interface OobaSettings{
    max_new_tokens: number,
    do_sample: boolean,
    temperature: number,
    top_p: number,
    typical_p: number,
    repetition_penalty: number,
    encoder_repetition_penalty: number,
    top_k: number,
    min_length: number,
    no_repeat_ngram_size: number,
    num_beams: number,
    penalty_alpha: number,
    length_penalty: number,
    early_stopping: boolean,
    seed: number,
    add_bos_token: boolean,
    truncation_length: number,
    ban_eos_token: boolean,
    skip_special_tokens: boolean,
    top_a: number,
    tfs: number,
    epsilon_cutoff: number,
    eta_cutoff: number,
    formating:{
        header:string,
        systemPrefix:string,
        userPrefix:string,
        assistantPrefix:string
        seperator:string
        useName:boolean
    }
}

export const defaultAIN:AINsettings = {
    top_p: 0.7,
    rep_pen: 1.0625,
    top_a: 0.08,
    rep_pen_slope: 1.7,
    rep_pen_range: 1024,
    typical_p: 1.0,
    badwords: '',
    stoptokens: '',
    top_k: 140
}

export const defaultOoba:OobaSettings = {
    max_new_tokens: 180,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    typical_p: 1,
    repetition_penalty: 1.15,
    encoder_repetition_penalty: 1,
    top_k: 20,
    min_length: 0,
    no_repeat_ngram_size: 0,
    num_beams: 1,
    penalty_alpha: 0,
    length_penalty: 1,
    early_stopping: false,
    seed: -1,
    add_bos_token: true,
    truncation_length: 4096,
    ban_eos_token: false,
    skip_special_tokens: true,
    top_a: 0,
    tfs: 1,
    epsilon_cutoff: 0,
    eta_cutoff: 0,
    formating:{
        header: "Below is an instruction that describes a task. Write a response that appropriately completes the request.",
        systemPrefix: "### Instruction:",
        userPrefix: "### Input:",
        assistantPrefix: "### Response:",
        seperator:"",
        useName:false,
    }
}

export const presetTemplate:botPreset = {
    name: "New Preset",
    apiType: "gpt35_0301",
    openAIKey: "",
    mainPrompt: defaultMainPrompt,
    jailbreak: defaultJailbreak,
    globalNote: "",
    temperature: 80,
    maxContext: 4000,
    maxResponse: 300,
    frequencyPenalty: 70,
    PresensePenalty: 70,
    formatingOrder: ['main', 'description', 'personaPrompt','chats','lastChat', 'jailbreak', 'lorebook', 'globalNote', 'authorNote'],
    aiModel: "gpt35_0301",
    subModel: "gpt35_0301",
    currentPluginProvider: "",
    textgenWebUIStreamURL: '',
    textgenWebUIBlockingURL: '',
    forceReplaceUrl: '',
    forceReplaceUrl2: '',
    promptPreprocess: false,
    proxyKey: '',
    bias: [],
    ooba: safeStructuredClone(defaultOoba),
    ainconfig: safeStructuredClone(defaultAIN),
    reverseProxyOobaArgs: {
        mode: 'instruct'
    },
    top_p: 1,
    useInstructPrompt: false,
}


export async function readPreset(f:{
    name:string
    data:Uint8Array
}|null = null){
    if(!f){
        return
    }

    let pre:any
    if(f.name.endsWith('.risupreset') || f.name.endsWith('.risup')){
        let data = f.data
        if(f.name.endsWith('.risup')){
            data = await decodeRPack(data)
        }
        const decoded = await decodeMsgpack(fflate.decompressSync(data))
        if((decoded.presetVersion === 0 || decoded.presetVersion === 2) && decoded.type === 'preset'){
            pre = {...presetTemplate,...decodeMsgpack(Buffer.from(await decryptBuffer(decoded.preset ?? decoded.pres, 'risupreset')))}
        }
    }
    else{
        pre = {...presetTemplate,...(JSON.parse(Buffer.from(f.data).toString('utf-8')))}
    }

    if(pre.presetVersion && pre.presetVersion >= 3){
        //NAI preset
        const pr = safeStructuredClone(prebuiltPresets.NAI2)
        pr.temperature = pre.parameters.temperature * 100
        pr.maxResponse = pre.parameters.max_length
        if (pr.NAISettings) {
            pr.NAISettings.topK = pre.parameters.top_k
            pr.NAISettings.topP = pre.parameters.top_p
            pr.NAISettings.topA = pre.parameters.top_a
            pr.NAISettings.typicalp = pre.parameters.typical_p
            pr.NAISettings.tailFreeSampling = pre.parameters.tail_free_sampling
            pr.NAISettings.repetitionPenalty = pre.parameters.repetition_penalty
            pr.NAISettings.repetitionPenaltyRange = pre.parameters.repetition_penalty_range
            pr.NAISettings.repetitionPenaltySlope = pre.parameters.repetition_penalty_slope
            pr.NAISettings.frequencyPenalty = pre.parameters.repetition_penalty_frequency
            pr.NAISettings.repostitionPenaltyPresence = pre.parameters.repetition_penalty_presence
            pr.NAISettings.cfg_scale = pre.parameters.cfg_scale
            pr.NAISettings.mirostat_lr = pre.parameters.mirostat_lr
            pr.NAISettings.mirostat_tau = pre.parameters.mirostat_tau
        }
        pr.PresensePenalty = pre.parameters.repetition_penalty_presence * 100
        pr.name = pre.name ?? "Imported"
        return pr
    }

    if(Array.isArray(pre?.prompt_order?.[0]?.order) && Array.isArray(pre?.prompts)){
        //ST preset
        const pr = safeStructuredClone(presetTemplate)
        pr.promptTemplate = []

        function findPrompt(identifier:number){
            return pre.prompts.find((p:any) => p.identifier === identifier)
        }
        pr.temperature = (pre.temperature ?? 0.8) * 100
        pr.frequencyPenalty = (pre.frequency_penalty ?? 0.7) * 100
        pr.PresensePenalty = (pre.presence_penalty * 0.7) * 100
        pr.top_p = pre.top_p ?? 1

        for(const prompt of pre?.prompt_order?.[0]?.order){
            if(!prompt?.enabled){
                continue
            }
            const p = findPrompt(prompt?.identifier ?? '')
            if(p){
                switch(p.identifier){
                    case 'main':{
                        pr.promptTemplate.push({
                            type: 'plain',
                            type2: 'main',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                        break
                    }
                    case 'jailbreak':
                    case 'nsfw':{
                        pr.promptTemplate.push({
                            type: 'jailbreak',
                            type2: 'normal',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                        break
                    }
                    case 'dialogueExamples':
                    case 'charPersonality':
                    case 'scenario':{
                        break //ignore
                    }
                    case 'chatHistory':{
                        pr.promptTemplate.push({
                            type: 'chat',
                            rangeEnd: 'end',
                            rangeStart: 0
                        })
                        break
                    }
                    case 'worldInfoBefore':{
                        pr.promptTemplate.push({
                            type: 'lorebook'
                        })
                        break
                    }
                    case 'worldInfoAfter':{
                        break
                    }
                    case 'charDescription':{
                        pr.promptTemplate.push({
                            type: 'description'
                        })
                        break
                    }
                    case 'personaDescription':{
                        pr.promptTemplate.push({
                            type: 'persona'
                        })
                        break
                    }
                    default:{
                        console.log(p)
                        pr.promptTemplate.push({
                            type: 'plain',
                            type2: 'normal',
                            text: p.content ?? "",
                            role: p.role ?? "system"
                        })
                    }
                }
            }
            else{
                console.log("Prompt not found", prompt)
            
            }
        }
        if(pre?.assistant_prefill){
            pr.promptTemplate.push({
                type: 'postEverything'
            })
            pr.promptTemplate.push({
                type: 'plain',
                type2: 'main',
                text: `{{#if {{prefill_supported}}}}${pre?.assistant_prefill}{{/if}}`,
                role: 'bot'
            })
        }
        pr.name = "Imported ST Preset"
        return pr
    }
    return pre
}