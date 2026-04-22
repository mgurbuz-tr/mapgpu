
import { SettingsChangedEvent } from "./SettingsChangedEvent"

export interface SettingsChangedEventListener {

	onSettingsChanged(sce: SettingsChangedEvent): void;

}


