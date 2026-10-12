from pathlib import Path
p=Path('src/App.tsx'); s=p.read_text(encoding='utf-8')
s=s.replace('  size: number;\n  extractionStatus:', '  size: number;\n  files?: Array<{ fileName: string; mimeType: string; size: number }>;\n  extractionStatus:',1)
s=s.replace('  fileName,\n  clear,','  fileName,\n  count,\n  clear,',1).replace('  fileName: string;\n  clear:', '  fileName: string;\n  count: number;\n  clear:',1)
s=s.replace('"Upload & generate report (1)"', '`Upload ${count} file(s) & generate one report`')
s=s.replace('const [file, setFile] = useState<File | null>(null);','const [files, setFiles] = useState<File[]>([]);',1)
s=s.replace('if (!file || uploading) return;', 'if (!files.length || uploading) return;\n    if (files.length > 10 || files.reduce((n, f) => n + f.size, 0) > 24 * 1024 * 1024) { setUploadError("Select up to 10 files, totaling no more than 24 MB."); return; }',1)
s=s.replace('if (file.size > 8 * 1024 * 1024)', 'if (files.some((file) => file.size > 8 * 1024 * 1024))',1)
a=s.index('      const [base64, extractedText] = await Promise.all(['); b=s.index('      const response = await fetch(',a)
s=s[:a]+'''      const payloadFiles = [];
      for (const [index, file] of files.entries()) {
        const [base64, extractedText] = await Promise.all([
          encodeFile(file), recognizeFile(file, (message) => setUploadProgress(`${index + 1}/${files.length} · ${file.name}: ${message}`)),
        ]);
        payloadFiles.push({ fileName: file.name, mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png"), size: file.size, base64, extractedText });
      }
      setUploadProgress("Saving all originals as one upload…");
'''+s[b:]
a=s.index('          body: JSON.stringify({',a);b=s.index('          }),',a)+len('          }),')
s=s[:a]+'          body: JSON.stringify({ files: payloadFiles }),'+s[b:]
s=s.replace('accept="image/*,.pdf"','accept="image/*,.pdf"\n            multiple\n            disabled={uploading}',1)
s=s.replace('setFile(e.target.files?.[0] || null);', 'setFiles(Array.from(e.target.files || []));',1)
s=s.replace('{file && (','{files.length > 0 && (',1).replace('fileName={file.name}', 'fileName={files.map((file) => file.name).join(" · ")}\n              count={files.length}',1).replace('clear={() => setFile(null)}','clear={() => { setFiles([]); if (picker.current) picker.current.value = ""; }}',1)
s=s.replace('files securely saved for this account.', 'upload records securely saved for this account.')
s=s.replace('One report per uploaded file. Original files are kept in Uploaded files.', 'One report per upload. Each upload can contain multiple original files.').replace('reports, one per uploaded file','reports, one per upload')
s=s.replace('<small>{record.fileName}</small>','<small>{record.fileName}</small>\n                    {record.files && <small>{record.files.length} original file(s)</small>}',1)
p.write_text(s,encoding='utf-8')
p=Path('src/components/UploadedReport.tsx');s=p.read_text(encoding='utf-8')
a=s.index('        const response = await fetch(original.url);');b=s.index('        await request(`records/${record.id}/text`',a)
s=s[:a]+'''        const texts = [];
        for (const fileSource of original.files || [original]) {
          const response = await fetch(fileSource.url);
          if (!response.ok) throw new Error(`Unable to download ${fileSource.fileName}.`);
          const file = new File([await response.blob()], fileSource.fileName, { type: fileSource.mimeType });
          const text = await recognizeFile(file, (message) => { if (active.current) setProgress(`${fileSource.fileName}: ${message}`); });
          if (!text.trim()) throw new Error(`No text was found in ${fileSource.fileName}. Try a clearer image.`);
          texts.push(`FILE: ${fileSource.fileName}\\n${text}`);
        }
        const extractedText = texts.join("\\n\\n");
'''+s[b:];p.write_text(s,encoding='utf-8')
