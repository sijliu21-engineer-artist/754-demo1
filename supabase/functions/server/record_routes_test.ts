import { storageFileName } from "./record_routes.tsx";

Deno.test("storage names remain ASCII while retaining the file extension", () => {
  const cases = [
    ["01_血常规.png", "original.png"],
    ["医生诊断书.PDF", "original.pdf"],
    ["scan 🏥.jpg", "original.jpg"],
    ["没有扩展名", "original.bin"],
  ];
  for (const [input, expected] of cases) {
    if (storageFileName(input) !== expected) throw new Error(`Invalid storage name for ${input}`);
  }
});
