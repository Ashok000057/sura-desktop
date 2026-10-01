import JSZip from 'jszip';
import { PYTHON_FILES } from '../data/pythonCode';

export async function downloadPythonCodebaseZip(): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('devpulse_python_backend');

  if (!folder) return;

  Object.values(PYTHON_FILES).forEach((file) => {
    folder.file(file.name, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'devpulse_python_backend.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadSingleFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
