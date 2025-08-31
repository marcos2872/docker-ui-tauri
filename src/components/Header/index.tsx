import { getCurrentWindow } from "@tauri-apps/api/window";
import { VscChromeMinimize, VscChromeClose } from "react-icons/vsc";

export function Header() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex justify-end items-center w-full px-3 h-8 gap-2 bg-gray-900 rounded-t-lg"
    >
      <button
        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-800"
        onClick={() => appWindow.minimize()}
      >
        <VscChromeMinimize color="#ffffff" />
      </button>
      <button
        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-800"
        onClick={() => appWindow.close()}
      >
        <VscChromeClose color="#ffffff" />
      </button>
    </div>
  );
}
