import React from 'react';
import { AlertTriangle, FileCode } from 'lucide-react';

interface Annotation {
  file: string;
  line: number;
  severity: string;
  note: string;
}

interface AnnotatedDiffPanelProps {
  diff: string;
  annotations: Annotation[];
}

const AnnotatedDiffPanel: React.FC<AnnotatedDiffPanelProps> = ({ diff, annotations }) => {
  // Simple diff parsing for visualization
  const lines = diff.split('\n');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 text-sm font-medium text-ps-text-muted mb-4">
        <FileCode size={16} className="text-ps-primary" />
        Annotated Code Diff
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-ps-border bg-ps-bg font-mono text-[11px] leading-tight">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const isAdded = line.startsWith('+') && !line.startsWith('+++');
              const isRemoved = line.startsWith('-') && !line.startsWith('---');
              const annotation = annotations.find(a => a.line === idx + 1);

              return (
                <React.Fragment key={idx}>
                  <tr 
                    className={`
                      ${isAdded ? 'bg-green-500/10 text-green-300' : ''}
                      ${isRemoved ? 'bg-red-500/10 text-red-300' : ''}
                      ${!isAdded && !isRemoved ? 'text-ps-text-muted' : ''}
                      hover:bg-ps-primary/5 group
                    `}
                  >
                    <td className="w-10 text-right pr-3 select-none text-ps-text-muted/50 border-r border-ps-border bg-ps-card/50">
                      {idx + 1}
                    </td>
                    <td className="pl-3 py-0.5 whitespace-pre-wrap break-all">
                      {line}
                    </td>
                  </tr>
                  {annotation && (
                    <tr>
                      <td className="bg-ps-card/50 border-r border-ps-border" />
                      <td className="p-3">
                        <div className={`
                          flex gap-3 p-3 rounded-lg border
                          ${annotation.severity === 'HIGH' ? 'bg-red-500/5 border-red-500/30' : 'bg-amber-500/5 border-amber-500/30'}
                        `}>
                          <AlertTriangle 
                            size={16} 
                            className={annotation.severity === 'HIGH' ? 'text-red-400' : 'text-amber-400'} 
                          />
                          <div>
                            <div className="font-bold text-[10px] uppercase mb-1 tracking-wider">
                              AI Finding: {annotation.severity} RISK
                            </div>
                            <p className="text-ps-text text-xs leading-normal italic">
                              {annotation.note}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnnotatedDiffPanel;
