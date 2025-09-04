import { useEffect, useState } from "react";
import { useDockerApi } from "../../hooks/useDockerApi";

interface IProps {
  changeScreen: (v: number) => void;
  screen: number;
}

export function NavBar({ changeScreen, screen }: IProps) {
  const { getDockerStatus } = useDockerApi();
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const status = (await getDockerStatus()) as string;
        setStatus(status);
      } catch (error) {
        console.error("Error getting Docker status:", error);
        setStatus("Error");
      }
    })();
  }, [getDockerStatus]);

  return (
    <div className="flex flex-col justify-between w-32 p-3 h-full bg-gray-900 rounded-bl-lg">
      <section className="flex flex-col items-start gap-6">
        <button
          className={`w-full h-8 ${screen == 0 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(0);
          }}
        >
          <p className="text-sm text-gray-300">Docker</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 1 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(1);
          }}
        >
          <p className="text-sm text-gray-300">Containers</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 2 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(2);
          }}
        >
          <p className="text-sm text-gray-300">Images</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 3 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(3);
          }}
        >
          <p className="text-sm text-gray-300">Volumes</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 4 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(4);
          }}
        >
          <p className="text-sm text-gray-300">Networks</p>
        </button>
        <button
          className={`w-full h-8 ${screen == 5 ? "bg-gray-700" : "bg-gray-800"} rounded-md`}
          onClick={() => {
            changeScreen(5);
          }}
        >
          <p className="text-sm text-gray-300">Servers</p>
        </button>
      </section>
      <div className="w-full flex justify-center">
        <p className="text-[10px] font-semibold text-green-500">{status}</p>
      </div>
    </div>
  );
}
