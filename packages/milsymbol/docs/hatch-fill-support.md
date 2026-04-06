# MIL-STD Area Symbols — Hatch Fill Desteği

`addHatchFills()` metodunda hangi area sembollerinin hatch pattern desteği olduğu ve hangilerinin eksik olduğu.

## Desteklenenler

| BasicID | Sembol | Hatch Style | Özel Durum |
|---------|--------|-------------|------------|
| 25240301 | NFA (No Fire Area) | Backward Diagonal | — |
| 25240302 | NFA Rectangular | Backward Diagonal | — |
| 25240303 | NFA Circular | Backward Diagonal | — |
| 25151100 | LAA (Low Air Area) | Forward Diagonal | Tek forward kullanan |
| 25271700 | BIO (Biological Contaminated) | Backward Diagonal | Sarı renk, 0.85x kalınlık |
| 25271800 | CHEM (Chemical Contaminated) | Backward Diagonal | Sarı renk, 0.85x kalınlık |
| 25271900 | NUC (Nuclear Contaminated) | Backward Diagonal | Sarı renk, 0.85x kalınlık |
| 25272000 | RAD (Radioactive Contaminated) | Backward Diagonal | Sarı renk, 0.85x kalınlık |
| 25172000 | WFZ (Weapons Free Zone) | Backward Diagonal | Siyahsa gri, 0.5x aralık |
| 25270300 | OBSAREA (Observation Area) | Backward Diagonal | 1.25x aralık |

## Desteklenmeyenler — Askeri Operasyon Alanları

| BasicID | Sembol |
|---------|--------|
| 25120100 | AO (Area of Operations) |
| 25120200 | NAI (Named Area of Interest) |
| 25120300 | TAI (Targeted Area of Interest) |
| 25120400 | Airfield |
| 25120500 | Base Camp |
| 25120600 | Guerrilla Base |
| 25120700 | Generic Area |
| 25141300 | Airhead |
| 25150100 | General Area |
| 25150200 | Assembly Area |
| 25150501 | JTAA (Joint Tactical Assembly Area) |
| 25150502 | SAA (Support Area Assembly) |
| 25150503 | SGAA (Staging Area Assembly) |
| 25151200 | Battle Position |
| 25151203 | Strongpoint |
| 25151300 | Engagement Area |
| 25151500 | Assault Position |
| 25151600 | Attack Position |
| 25151700 | Objective |
| 25151800 | Encirclement |
| 25151900 | Penetration Box |
| 25272200 | DRCL |

## Desteklenmeyenler — Tehlikeli / Kısıtlı Alanlar

| BasicID | Sembol |
|---------|--------|
| 25151000 | Fortified Area |
| 25270800 | Mined Area |
| 25270801 | Fenced Area |
| 25271000 | UXO Area |
| 25310100 | DHA (Defended Hazard Area) |
| 25310200 | EPW Holding Area |
| 25310400 | RHA (Restricted Hazard Area) |
| 25310500 | RSA (Restricted Support Area) |
| 25310600 | BSA (Brigade Support Area) |
| 25310700 | DSA (Division Support Area) |
| 25310800 | CSA (Corps Support Area) |
| 25242800 | Kill Zone |
| 25242301 | Killbox Blue |
| 25242304 | Killbox Purple |

## Desteklenmeyenler — Hava Savunma / Ateş Kontrol Bölgeleri

| BasicID | Sembol |
|---------|--------|
| 25150600 | DZ (Drop Zone) |
| 25150700 | EZ (Extraction Zone) |
| 25150800 | LZ (Landing Zone) |
| 25150900 | PZ (Pickup Zone) |
| 25170900 | HIDACZ |
| 25171000 | ROZ (Restricted Operations Zone) |
| 25171100 | AARROZ |
| 25171200 | UAROZ |
| 25171300 | WEZ (Weapon Engagement Zone) |
| 25171400 | FEZ (Fighter Engagement Zone) |
| 25171500 | JEZ (Joint Engagement Zone) |
| 25171600 | MEZ (Missile Engagement Zone) |
| 25171700 | LOMEZ (Low MEZ) |
| 25171800 | HIMEZ (High MEZ) |
| 25171900 | FAADZ |

## Desteklenmeyenler — Ateş Destek Alanları

| BasicID | Sembol |
|---------|--------|
| 25240101 | ACA (Airspace Coordination Area) |
| 25240201 | FFA (Free Fire Area) |
| 25240503 | PAA (Position Area Artillery) |
| 25240806 | Smoke Area |
| 25240808 | Bomb Area |
| 25241001 | FSA (Fire Support Area) |
| 25241201 | CFFZ (Call for Fire Zone) |
| 25241301 | Censor Zone |
| 25241401 | CFZ (Critical Friendly Zone) |
| 25241501 | DA (Deadly Area) |
| 25241901 | ZOR (Zone of Responsibility) |
| 25310300 | FARP |

## Kök Neden

`addHatchFills()` içinde yalnızca NFA, LAA, BIO/NUC/CHEM/RAD, WFZ, OBSAREA için hardcoded case var. Diğer semboller `default` case'e düşüyor:

```typescript
default: {
    if (hatchStyle <= 0) {  // tg.fillStyle = _patternFillType = 0 (hiç set edilmiyor)
        return;             // hatch üretilmeden çıkıyor
    }
}
```

`_patternFillType` alanı external API olarak tasarlanmış ama hiçbir yerde set edilmiyor.

## Not

Tüm bu semboller MIL-STD-2525D/E spesifikasyonuna göre kontrol edilmeli — hangilerinin gerçekten hatch pattern gerektirdiği belirlenip `addHatchFills` switch'ine eklenmeli.
