import { Modifiers } from "./Modifiers"
import { MSInfo } from "./MSInfo"
import { SymbolID } from "./SymbolID"
import { SymbolUtilities } from "./SymbolUtilities"
import { ErrorLogger } from "./ErrorLogger";
import { LogLevel } from "./LogLevel";
import { RendererUtilities } from "./RendererUtilities";
import { dataLoader } from "./DataLoader";

// Eager imports kept for backward compatibility — will be tree-shaken
// when consumers switch to initLazy().
import jsond from '../../data/msd.json';
import jsone from '../../data/mse.json';

/**
 * Class that holds all the  objects with symbol information
 */
export class MSLookup {

    private static mse: any;
    private static msd: any;
    private static _instance: MSLookup;
    private static _initCalled: boolean = false;
    private static _isReady: boolean = false;

    private static _MSLookupD: Map<string, MSInfo>;
    private static _MSLookupE: Map<string, MSInfo>;
    //private TAG: string = "MSLookup";
    private _IDListD: Array<string> = [];
    private _IDListE: Array<string> = [];
    private static msdJSON:string = "/msd.json";
    private static mseJSON:string = "/mse.json";

    /** Tracks which symbol sets have been lazily loaded into the maps */
    private static _loadedSymbolSetsD: Set<string> = new Set();
    private static _loadedSymbolSetsE: Set<string> = new Set();

    /** When true, init() skips eager loading of monolithic JSON */
    private static _lazyMode: boolean = false;

    /** Promise tracking for in-flight lazy loads */
    private static _loadingPromises: Map<string, Promise<void>> = new Map();

    /**
     * @deprecated
     */
    public static async setData(urls:string[])
    {
        // Legacy stub — no-op
    }

    /*
     * Holds SymbolDefs for all symbols. (basicSymbolID, Description, MinPoint, MaxPoints, etc...) Call
     * getInstance().
     *
     */
    private constructor()
    {
        this.init();
    }

    public static getInstance(): MSLookup {
        if (!MSLookup._instance) {
            MSLookup._instance = new MSLookup();
        }
        return MSLookup._instance;
    }

    // ─── Lazy Initialization ─────────────────────────────────────────────────

    /**
     * Initialize MSLookup in lazy mode — no monolithic JSON is loaded upfront.
     * Symbol-set-specific data is loaded on demand via ensureSymbolSet().
     *
     * @returns Promise that resolves when the instance is ready for lazy loading
     */
    public static async initLazy(): Promise<MSLookup> {
        MSLookup._lazyMode = true;

        if (!MSLookup._instance) {
            MSLookup._instance = new MSLookup();
        }

        MSLookup._isReady = true;
        return MSLookup._instance;
    }

    /**
     * Ensure a symbol set's MS data is loaded and available for synchronous lookup.
     * In eager mode, this is a no-op. In lazy mode, it loads the chunk on demand.
     *
     * @param symbolSet Two-digit symbol set code (e.g., "10", "25")
     * @param version SymbolID version constant
     */
    public static async ensureSymbolSet(symbolSet: string, version: number): Promise<void> {
        if (!MSLookup._lazyMode) return;

        const ss = symbolSet.padStart(2, '0');
        const isE = version >= SymbolID.Version_2525E;
        const loadedSet = isE ? MSLookup._loadedSymbolSetsE : MSLookup._loadedSymbolSetsD;
        const versionStr = isE ? '2525e' : '2525d';

        if (loadedSet.has(ss)) return;

        const loadKey = `${versionStr}:${ss}`;
        if (MSLookup._loadingPromises.has(loadKey)) {
            return MSLookup._loadingPromises.get(loadKey);
        }

        const loadPromise = (async () => {
            try {
                const loader = dataLoader;
                const data = await loader.loadMSSymbolSet(ss, versionStr);
                if (data) {
                    MSLookup._instance.populateLookupFromChunk(data, ss, version);
                    loadedSet.add(ss);
                }
            } finally {
                MSLookup._loadingPromises.delete(loadKey);
            }
        })();

        MSLookup._loadingPromises.set(loadKey, loadPromise);
        return loadPromise;
    }

    /**
     * Ensure all symbol sets needed for a full SIDC are loaded.
     */
    public static async ensureForSIDC(symbolID: string): Promise<void> {
        if (!MSLookup._lazyMode) return;

        const ss = symbolID.substring(4, 6);
        const version = SymbolID.getVersion(symbolID);

        await MSLookup.ensureSymbolSet(ss, version);
    }

    /**
     * Returns whether lazy mode is active.
     */
    public static isLazyMode(): boolean {
        return MSLookup._lazyMode;
    }

    /**
     * Check if a specific symbol set is loaded (useful in lazy mode).
     */
    public static isSymbolSetLoaded(symbolSet: string, version: number): boolean {
        if (!MSLookup._lazyMode) return true;
        const ss = symbolSet.padStart(2, '0');
        if (version >= SymbolID.Version_2525E) {
            return MSLookup._loadedSymbolSetsE.has(ss);
        }
        return MSLookup._loadedSymbolSetsD.has(ss);
    }

    // ─── Eager Initialization (backward compat) ─────────────────────────────

    private init(): void {

        if (!MSLookup._lazyMode && typeof jsond === 'object')
        {
            MSLookup.msd = jsond;
            MSLookup.mse = jsone;
        }

        if (MSLookup._initCalled === false) {
            MSLookup._initCalled = true;
            MSLookup._MSLookupD = new Map();
            MSLookup._MSLookupE = new Map();
            this._IDListD = new Array();
            this._IDListE = new Array();

            try
            {
                if (!MSLookup._lazyMode) {
                    // Eager mode: load all data immediately (original behavior)
                    this.populateLookup(SymbolID.Version_2525Dch1);
                    this.populateLookup(SymbolID.Version_2525E);
                    if(this._IDListD.length > 0 && this._IDListE.length > 0)
                        MSLookup._isReady = true;
                }
                // In lazy mode, maps are created empty and populated on demand
            } catch (e) {
                if (e instanceof Error) {
                    console.log(e.message);
                } else {
                    throw e;
                }
            }
        }
    }

    public isReady():boolean
    {
        return MSLookup._isReady;
    }

    private async populateLookup(version: number) {
        let lookup: Map<string, MSInfo>;
        let list: Array<string>;
        type JSONSymbol = {
            ss: string;
            e: string;
            et: string;
            est: string;
            code: string;
            geometry?: string;
            drawRules?: string;
            modifiers?: string;
            aux1?: string;
        }
        let intSS: number = 0;

        try 
        {
            let msJSON: JSONSymbol[];
            if (version >= SymbolID.Version_2525E) {
                lookup = MSLookup._MSLookupE;
                list = this._IDListE;
                msJSON = MSLookup.mse["mse"]["SYMBOL"]
            } else {
                lookup = MSLookup._MSLookupD;
                list = this._IDListD;
                msJSON = MSLookup.msd["msd"]["SYMBOL"]
            }

            let ss: string = ""
            let e: string = ""
            let et: string = ""
            let est: string = ""
            for (let JSONSymbol of msJSON) {
                if (JSONSymbol.code.length != 6) {
                    JSONSymbol.code = "000000";
                }
                if (JSONSymbol.ss !== "") {
                    ss = JSONSymbol.ss;
                }

                if(JSONSymbol.e !== null && JSONSymbol.e !=="")
                {
                    e = JSONSymbol.e;
                    et = "";
                    est = "";
                }

                if(JSONSymbol.et !== null && JSONSymbol.et !=="")
                {
                    et = JSONSymbol.et;
                    est = "";
                }

                if(JSONSymbol.est !== null && JSONSymbol.est !=="")
                {
                    est = JSONSymbol.est;
                }

                intSS = parseInt(ss);
                let id = ss + JSONSymbol.code;
                if (JSONSymbol.code !== "000000") {
                    if (JSONSymbol.geometry || JSONSymbol.drawRules) {//Control Measures and METOCS
                        let modifiers: Array<string> = new Array<string>() ;
                        if (JSONSymbol.modifiers != null && JSONSymbol.modifiers != "null" && JSONSymbol.modifiers !== "") 
                        {
                            modifiers = JSONSymbol.modifiers.split(",");
                        }

                        let g: string = JSONSymbol.geometry || "";
                        let dr: string = JSONSymbol.drawRules || "";
                        lookup.set(id, new MSInfo(version, ss, e, et, est, JSONSymbol.code, g, dr, this.populateModifierList(modifiers)));
                    } else {//Everything else
                        //_MSLookupD.set(id, new MSInfo(ss, e, et, est, ec));
                        lookup.set(id, new MSInfo(version, ss, e, et, est, JSONSymbol.code, this.populateModifierList(ss, JSONSymbol.code, version)));
                    }
                    list.push(id);
                }
                else if(intSS != SymbolID.SymbolSet_ControlMeasure &&
                    intSS != SymbolID.SymbolSet_Atmospheric &&
                    intSS != SymbolID.SymbolSet_Oceanographic &&
                    intSS != SymbolID.SymbolSet_MeteorologicalSpace)
                {
                    lookup.set(id, new MSInfo(version, ss, e, et, est, JSONSymbol.code, this.populateModifierList(ss,JSONSymbol.code, version)));
                    list.push(id);
                }
            }
            if(version < SymbolID.Version_2525E)//add handful of SymbolID.Version_2525D codes to lookup
            {
                this.AddVersion10Symbols(lookup);
            }
        } 
        catch (exc) 
        {
            if (exc instanceof Error) {
                console.log(exc.message);
            } else {
                throw exc;
            }
        }
    }

    private AddVersion10Symbols(lookup:Map<String,MSInfo>):void
    {
        let id:string = null;
        let ss:string = null;
        let intSS:number = 0;
        let e:string = null;
        let et:string = null;
        let est:string = null;
        let ec:string = null;
        let g:string = null;
        let dr:string = null;
        let m:string = null;
        let modifiers:string[] = null;

        let units:string[] = ["120300", "161900", "162200", "162600", "162700", "163400", "163800", "163900", "164100", "164700"];
        let similar:string[] = ["120200", "161800", "161800", "161800", "161800", "161800", "161800", "161800", "161800", "161800"];
        let unitNames:string[] = ["Amphibious",
                "NATO Supply Class II",
                "NATO Supply Class V",
                "Pipeline",
                "Postal",
                "Supply",
                "US Supply Class II",
                "US Supply Class III",
                "US Supply Class IV",
                "Water"];

        let msiTemp:MSInfo = null;
        ss = "10";
        for(let i:number = 0; i < units.length; i++)
        {
            msiTemp = lookup.get("10" + similar[i]);
            let path:string[]  = msiTemp.getPath().split("/");

            ss = path[0];
            if(path.length>2)
                e = path[1];
            if(path.length>3)
                et = path[2];

            if(e == null || e === "")
                e = unitNames[i];
            else if(et == null || et === "")
                et = unitNames[i];
            else
                est = unitNames[i];

            ec = units[i];

            lookup.set(10 + ec, new MSInfo(SymbolID.Version_2525D, "10", e, et, est, ec, this.populateModifierList("10",ec, SymbolID.Version_2525Dch1)));
        }
        est = "";

        lookup.set("25214000", new MSInfo(SymbolID.Version_2525D, "25", "Maritime Control Points", "Forward Observer - Spotter Position", est, "214000", "Point","Point2",this.populateModifierList("25","214000", SymbolID.Version_2525Dch1)));
        //3 point Bridge not implemented
        //lookup.set("25271400", new MSInfo(SymbolID.Version_2525D, "25", "Protection Areas", "Bridge", est, "271400", "Line","Line16",this.populateModifierList("25","271400", SymbolID.Version_2525Dch1)));

    }

    // ─── Lazy Loading: Chunk-based population ────────────────────────────────

    /**
     * Populate lookup maps from a lazily-loaded chunk.
     * The chunk format is: { symbolSet: "NN", symbols: [...] }
     * where symbols is the same format as the original JSON SYMBOL array.
     */
    private populateLookupFromChunk(chunkData: any, symbolSet: string, version: number): void {
        const rawData = chunkData.default || chunkData;
        const symbols = rawData.symbols;
        if (!symbols || !Array.isArray(symbols)) return;

        const lookup = version >= SymbolID.Version_2525E ? MSLookup._MSLookupE : MSLookup._MSLookupD;
        const list = version >= SymbolID.Version_2525E ? this._IDListE : this._IDListD;
        const intSS = parseInt(symbolSet);

        let ss = symbolSet;
        let e = "";
        let et = "";
        let est = "";

        for (const sym of symbols) {
            if (sym.code && sym.code.length !== 6) {
                sym.code = "000000";
            }
            if (sym.ss && sym.ss !== "") {
                ss = sym.ss;
            }
            if (sym.e !== null && sym.e !== "") {
                e = sym.e;
                et = "";
                est = "";
            }
            if (sym.et !== null && sym.et !== "") {
                et = sym.et;
                est = "";
            }
            if (sym.est !== null && sym.est !== "") {
                est = sym.est;
            }

            const id = ss + sym.code;
            if (sym.code !== "000000") {
                if (sym.geometry || sym.drawRules) {
                    let modifiers: Array<string> = [];
                    if (sym.modifiers != null && sym.modifiers !== "null" && sym.modifiers !== "") {
                        modifiers = sym.modifiers.split(",");
                    }
                    const g = sym.geometry || "";
                    const dr = sym.drawRules || "";
                    lookup.set(id, new MSInfo(version, ss, e, et, est, sym.code, g, dr, this.populateModifierList(modifiers)));
                } else {
                    lookup.set(id, new MSInfo(version, ss, e, et, est, sym.code, this.populateModifierList(ss, sym.code, version)));
                }
                if (!list.includes(id)) {
                    list.push(id);
                }
            } else if (
                intSS !== SymbolID.SymbolSet_ControlMeasure &&
                intSS !== SymbolID.SymbolSet_Atmospheric &&
                intSS !== SymbolID.SymbolSet_Oceanographic &&
                intSS !== SymbolID.SymbolSet_MeteorologicalSpace
            ) {
                lookup.set(id, new MSInfo(version, ss, e, et, est, sym.code, this.populateModifierList(ss, sym.code, version)));
                if (!list.includes(id)) {
                    list.push(id);
                }
            }
        }

        // For 2525D, add special version 10 symbols when loading SS 10 or 25
        if (version < SymbolID.Version_2525E && (symbolSet === '10' || symbolSet === '25')) {
            this.AddVersion10Symbols(lookup);
        }
    }

    // ─── Async Lookup (new API for lazy mode) ────────────────────────────────

    /**
     * Async version of getMSLInfo — ensures the required symbol set is loaded
     * before performing the lookup. Safe to use in both eager and lazy modes.
     */
    public async getMSLInfoAsync(basicID: string, version: number): Promise<MSInfo | null>;
    public async getMSLInfoAsync(symbolID: string): Promise<MSInfo | null>;
    public async getMSLInfoAsync(...args: unknown[]): Promise<MSInfo | null> {
        if (MSLookup._lazyMode) {
            let basicID: string;
            let version: number;

            if (args.length === 1) {
                const [symbolID] = args as [string];
                if (symbolID.length >= 20 && symbolID.length <= 30) {
                    basicID = SymbolUtilities.getBasicSymbolID(symbolID);
                    version = SymbolID.getVersion(symbolID);
                } else {
                    return null;
                }
            } else {
                [basicID, version] = args as [string, number];
                if (basicID.length >= 20 && basicID.length <= 30) {
                    basicID = SymbolUtilities.getBasicSymbolID(basicID);
                }
            }

            if (basicID && basicID.length === 8) {
                const ss = basicID.substring(0, 2);
                await MSLookup.ensureSymbolSet(ss, version);
            }
        }

        // Delegate to synchronous version
        if (args.length === 1) {
            return this.getMSLInfo(args[0] as string);
        }
        return this.getMSLInfo(args[0] as string, args[1] as number);
    }

    // ─── Memory Management ──────────────────────────────────────────────────

    /**
     * Get memory usage stats from the DataLoader (lazy mode only).
     */
    public static getDataLoaderStats() {
        return dataLoader.getMemoryUsage();
    }

    /**
     * Reset the singleton for testing purposes.
     */
    public static resetForTesting(): void {
        MSLookup._instance = null;
        MSLookup._initCalled = false;
        MSLookup._isReady = false;
        MSLookup._lazyMode = false;
        MSLookup._loadedSymbolSetsD = new Set();
        MSLookup._loadedSymbolSetsE = new Set();
        MSLookup._loadingPromises = new Map();
    }

    private populateModifierList(modifiers: string[] | null): Array<string>;

    private populateModifierList(symbolSet: string, ec: string, version: number): Array<string>;
    private populateModifierList(...args: unknown[]): Array<string> {
        switch (args.length) {
            case 1: {
                const [modifiers] = args as [string[]];

                let mods: Array<string> = new Array<string>();
                
                if (modifiers != null && modifiers.length > 0) {
                    for (let mod of modifiers) 
                    {
                        let key:string = Modifiers.getModifierKey(mod);
                        if(key != null)
                            mods.push(key);
                    }
                }
                return mods;
            }

            case 3: {
                const [symbolSet, ec, version] = args as [string, string, number];

                let ss: number = parseInt(symbolSet);
                let modifiers: Array<string> = new Array<string>();

                if (version >= SymbolID.Version_2525E) {
                    switch (ss) {
                        case SymbolID.SymbolSet_LandUnit:
                        case SymbolID.SymbolSet_LandCivilianUnit_Organization: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.B_ECHELON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.D_TASK_FORCE_INDICATOR);
                            modifiers.push(Modifiers.F_REINFORCED_REDUCED);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.L_SIGNATURE_EQUIP);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            if (ss === SymbolID.SymbolSet_LandUnit && ec === "110000") {

                                modifiers.push(Modifiers.AA_SPECIAL_C2_HQ);
                            }

                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_LandEquipment:
                        case SymbolID.SymbolSet_SignalsIntelligence_Land: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.L_SIGNATURE_EQUIP);
                            modifiers.push(Modifiers.N_HOSTILE);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.R_MOBILITY_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);
                            modifiers.push(Modifiers.AG_AUX_EQUIP_INDICATOR);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_LandInstallation: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            //modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_DismountedIndividuals: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            modifiers.push(Modifiers.AV_LEADERSHIP);
                            break;
                        }

                        case SymbolID.SymbolSet_Space:
                        case SymbolID.SymbolSet_SpaceMissile: 
                        case SymbolID.SymbolSet_Air:
                        case SymbolID.SymbolSet_AirMissile: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.B_ECHELON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            //modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_SeaSurface: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            //modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AG_AUX_EQUIP_INDICATOR);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_SeaSubsurface: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            //modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_Activities: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_CyberSpace: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.B_ECHELON);
                            modifiers.push(Modifiers.F_REINFORCED_REDUCED);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.L_SIGNATURE_EQUIP);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        /*case SymbolID.SymbolSet_SignalsIntelligence_Air:
                        case SymbolID.SymbolSet_SignalsIntelligence_Land:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSubsurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_Space:
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.D_TASK_FORCE_INDICATOR);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.R2_SIGNIT_MOBILITY_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W1_DTG_2);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);//like equipment
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);//like equipment
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);//like equipment
                            break;*/

                        case SymbolID.SymbolSet_ControlMeasure: {
                            //values come from files during MSLookup load
                            break;
                        }

                        case SymbolID.SymbolSet_Atmospheric: {
                            //Tropopause low, Tropopause high
                            if ((ec === "110102") || (ec === "110202") ||
                                (ec === "162200")) {

                                modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            }

                            else {
                                if (ec === "140200") {

                                    modifiers.push(Modifiers.AN_AZIMUTH);
                                }

                            }

                            break;
                        }

                        case SymbolID.SymbolSet_MineWarfare:
                        case SymbolID.SymbolSet_Oceanographic:
                        case SymbolID.SymbolSet_MeteorologicalSpace:
                        default://no modifiers

                    }
                }
                else {
                    switch (ss) {
                        case SymbolID.SymbolSet_LandUnit:
                        case SymbolID.SymbolSet_LandCivilianUnit_Organization: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.B_ECHELON);
                            modifiers.push(Modifiers.D_TASK_FORCE_INDICATOR);
                            modifiers.push(Modifiers.F_REINFORCED_REDUCED);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            if (ss === SymbolID.SymbolSet_LandUnit && ec === "110000") {

                                modifiers.push(Modifiers.AA_SPECIAL_C2_HQ);
                            }

                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_LandEquipment:
                        case SymbolID.SymbolSet_SignalsIntelligence_Land: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.C_QUANTITY);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.L_SIGNATURE_EQUIP);
                            modifiers.push(Modifiers.N_HOSTILE);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.R_MOBILITY_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);
                            modifiers.push(Modifiers.AG_AUX_EQUIP_INDICATOR);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_LandInstallation: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AH_AREA_OF_UNCERTAINTY);
                            modifiers.push(Modifiers.AI_DEAD_RECKONING_TRAILER);
                            modifiers.push(Modifiers.AK_PAIRING_LINE);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_Space:
                        case SymbolID.SymbolSet_SpaceMissile:
                        case SymbolID.SymbolSet_SignalsIntelligence_Space: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_Air:
                        case SymbolID.SymbolSet_AirMissile:
                        case SymbolID.SymbolSet_SignalsIntelligence_Air: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);//air only
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_SeaSurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSurface: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.P_IFF_SIF_AIS);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.Z_SPEED);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AQ_GUARDED_UNIT);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_SeaSubsurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSubsurface: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.AG_AUX_EQUIP_INDICATOR);
                            modifiers.push(Modifiers.AL_OPERATIONAL_CONDITION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AR_SPECIAL_DESIGNATOR);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AJ_SPEED_LEADER);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_Activities: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.Q_DIRECTION_OF_MOVEMENT);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AB_FEINT_DUMMY_INDICATOR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        case SymbolID.SymbolSet_CyberSpace: {
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.B_ECHELON);
                            modifiers.push(Modifiers.D_TASK_FORCE_INDICATOR);
                            modifiers.push(Modifiers.F_REINFORCED_REDUCED);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.K_COMBAT_EFFECTIVENESS);
                            modifiers.push(Modifiers.L_SIGNATURE_EQUIP);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.S_HQ_STAFF_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W_DTG_1);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AO_ENGAGEMENT_BAR);
                            modifiers.push(Modifiers.AS_COUNTRY);
                            break;
                        }

                        /*case SymbolID.SymbolSet_SignalsIntelligence_Air:
                        case SymbolID.SymbolSet_SignalsIntelligence_Land:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_SeaSubsurface:
                        case SymbolID.SymbolSet_SignalsIntelligence_Space:
                            modifiers.push(Modifiers.A_SYMBOL_ICON);
                            modifiers.push(Modifiers.D_TASK_FORCE_INDICATOR);
                            modifiers.push(Modifiers.G_STAFF_COMMENTS);
                            modifiers.push(Modifiers.H_ADDITIONAL_INFO_1);
                            modifiers.push(Modifiers.J_EVALUATION_RATING);
                            modifiers.push(Modifiers.M_HIGHER_FORMATION);
                            modifiers.push(Modifiers.R2_SIGNIT_MOBILITY_INDICATOR);
                            modifiers.push(Modifiers.T_UNIQUE_DESIGNATION_1);
                            modifiers.push(Modifiers.V_EQUIP_TYPE);
                            modifiers.push(Modifiers.W1_DTG_2);
                            modifiers.push(Modifiers.Y_LOCATION);
                            modifiers.push(Modifiers.AD_PLATFORM_TYPE);//like equipment
                            modifiers.push(Modifiers.AE_EQUIPMENT_TEARDOWN_TIME);//like equipment
                            modifiers.push(Modifiers.AF_COMMON_IDENTIFIER);//like equipment
                            break;*/

                        case SymbolID.SymbolSet_ControlMeasure: {
                            //values come from files during MSLookup load
                            break;
                        }

                        case SymbolID.SymbolSet_Atmospheric: {
                            //Tropopause low, Tropopause high
                            if ((ec === "110102") || (ec === "110202") ||
                                (ec === "162200")) {
                                modifiers.push(Modifiers.X_ALTITUDE_DEPTH);
                            } else {
                                if (ec === "140200") {
                                    modifiers.push(Modifiers.AN_AZIMUTH);
                                }

                            }

                            break;
                        }

                        case SymbolID.SymbolSet_MineWarfare:
                        case SymbolID.SymbolSet_Oceanographic:
                        case SymbolID.SymbolSet_MeteorologicalSpace:
                        default://no modifiers

                    }
                }

                if (ss === SymbolID.SymbolSet_SignalsIntelligence_Air ||
                    ss === SymbolID.SymbolSet_SignalsIntelligence_Land ||
                    ss === SymbolID.SymbolSet_SignalsIntelligence_SeaSurface ||
                    ss === SymbolID.SymbolSet_SignalsIntelligence_SeaSubsurface ||
                    ss === SymbolID.SymbolSet_SignalsIntelligence_Space) {

                    modifiers.push(Modifiers.R2_SIGNIT_MOBILITY_INDICATOR);
                }

                return modifiers;
            }

            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * @param symbolID Full 20-30 digits from the symbol code
     * @return 
     */
    public getMSLInfo(symbolID: string): MSInfo;

    /**
     * @param basicID id SymbolSet + Entity code like 50110100
     * @param version like SymbolID.Version_2525Dch1
     * @return 
     */
    public getMSLInfo(basicID: string, version: number): MSInfo;
    public getMSLInfo(...args: unknown[]): MSInfo | null {
        switch (args.length) {
            case 1: {
                const [symbolID] = args as [string];

                let length: number = symbolID.length;

                if (length >= 20 && length <= 30) {
                    let version: number = SymbolID.getVersion(symbolID);
                    return this.getMSLInfo(SymbolUtilities.getBasicSymbolID(symbolID), version);
                } else {
                    return null;
                }
            }

            case 2: {
                const [basicID, version] = args as [string, number];

                let length: number = basicID.length;
                if (length === 8) {
                    if (version >= SymbolID.Version_2525E) {
                        return MSLookup._MSLookupE.get(basicID) || null;
                    } else if (version === SymbolID.Version_2525D && basicID === "25272100") {
                        // MSDZ can have extra point in D
                        return new MSInfo(SymbolID.Version_2525D, "25",
                                "Protection Areas", "Minimum Safe Distance Zone", "",
                                "272100", "Area", "Area14", []);
                    } else {
                        return MSLookup._MSLookupD.get(basicID) || null;
                    }
                } else {
                    if (length >= 20 && length <= 30)//probably got a full id instead of a basic ID.
                    {
                        return this.getMSLInfo(SymbolUtilities.getBasicSymbolID(basicID), version);
                    } else {
                        return null;
                    }
                }
            }
            default: {
                throw Error(`Invalid number of arguments`);
            }
        }
    }


    /**
     * returns a list of all the keys in the order they are listed in the MilStd 2525D document.
     * @param version see {@link SymbolID.Version_2525E} and {@link SymbolID.Version_2525Dch1}
     * @return 
     */
    public getIDList(version: number): Array<string> {
        if (version < SymbolID.Version_2525E) {
            return this._IDListD;
        } else if (version >= SymbolID.Version_2525E) {
            return this._IDListE;
        } else {
            return this._IDListD;
        }
    }

    public addCustomSymbol(msInfo:MSInfo):boolean
    {
        let success = false;
        try
        {
            let version:number = msInfo.getVersion();
            if (version < SymbolID.Version_2525E) 
            {
                if(this._IDListD.indexOf(msInfo.getBasicSymbolID()) == -1)
                {
                    this._IDListD.push(msInfo.getBasicSymbolID());
                    MSLookup._MSLookupD.set(msInfo.getBasicSymbolID(), msInfo);
                    success = true;
                }
                else
                    ErrorLogger.LogMessage("Symbol Set and Entity Code combination already exist: " + msInfo.getBasicSymbolID(), LogLevel.INFO,false);
            }
            else if (version >= SymbolID.Version_2525E) 
            {
                if(this._IDListE.indexOf(msInfo.getBasicSymbolID()) == -1)
                {
                    this._IDListE.push(msInfo.getBasicSymbolID());
                    MSLookup._MSLookupE.set(msInfo.getBasicSymbolID(), msInfo);
                    success = true;
                }
                else
                    ErrorLogger.LogMessage("Symbol Set and Entity Code combination already exist: " + msInfo.getBasicSymbolID(), LogLevel.INFO,false);
            }
        }
        catch(e)
        {
            if (e instanceof Error) {
                ErrorLogger.LogException("MSLookup", "addCustomSymbol",e);
            }
        }
        return success;

    }
}

// Deferred initialization to avoid circular-dependency issues at module load time.
// The singleton is created on first property access rather than at import time.
export const msLookup: MSLookup = new Proxy({} as MSLookup, {
    get(_target, prop) {
        const instance = MSLookup.getInstance();
        const value = Reflect.get(instance, prop, instance);
        return typeof value === 'function' ? (value as Function).bind(instance) : value;
    }
});
