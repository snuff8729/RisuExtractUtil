
export interface loreBook{
    key:string
    secondkey:string
    insertorder: number
    comment: string
    content: string
    mode: 'multiple'|'constant'|'normal'|'child',
    alwaysActive: boolean
    selective:boolean
    extentions?:{
        risu_case_sensitive:boolean
    }
    activationPercent?:number
    loreCache?:{
        key:string
        data:string[]
    },
    useRegex?:boolean
    bookVersion?:number
    id?:string
}

export interface customscript{
    comment: string;
    in:string
    out:string
    type:string
    flag?:string
    ableFlag?:boolean
}

export interface triggerscript{
    comment: string;
    type: 'start'|'manual'|'output'|'input'|'display'|'request'
    conditions: any
    effect:any
    lowLevelAccess?: boolean
}

export interface RisuModule{
    name: string
    description: string
    lorebook?: loreBook[]
    regex?: customscript[]
    cjs?: string
    trigger?: triggerscript[]
    id: string
    lowLevelAccess?: boolean
    hideIcon?: boolean
    backgroundEmbedding?:string
    assets?:[string,string,string][]
    namespace?:string
    customModuleToggle?:string
}
