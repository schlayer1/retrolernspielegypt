/**
 * Druckoptimiertes A4-Hefterblatt für Schüler & Lehrkräfte (PrintSheet.ts)
 * Erzeugt einen sauberen, tintensparenden DIN A4 Ausdruck für die Geschichtsmappe.
 */

export interface PrintSheetData {
  schoolName: string;
  epochTitle: string;
  playerName: string;
  hefterCode: string;
  rankTitle: string;
  relics: { title: string; note: string }[];
  dilemmaSummary?: string;
  keyTerms: { term: string; definition: string }[];
}

export class PrintSheetManager {
  public static triggerPrint(data: PrintSheetData): void {
    const existing = document.getElementById('hefter-print-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.id = 'hefter-print-sheet';
    sheet.className = 'print-sheet-root';

    sheet.innerHTML = `
      <div class="print-page">
        <!-- Kopfzeile -->
        <div class="print-header">
          <div class="print-school-meta">
            <span>${data.schoolName}</span> • <span>Fachunterricht Geschichte</span>
          </div>
          <h1 class="print-title">${data.epochTitle}</h1>
          <div class="print-meta-grid">
            <div>Forscher/in: <strong>${data.playerName || 'Schüler/in'}</strong></div>
            <div>Datum: <strong>${new Date().toLocaleDateString('de-DE')}</strong></div>
            <div>Klasse: <strong>________</strong></div>
            <div class="print-code-box">Hefter-Code: <strong>${data.hefterCode}</strong></div>
          </div>
        </div>

        <hr class="print-divider" />

        <!-- 1. Geborgene Relikte & Primärquellen -->
        <div class="print-section">
          <h2>1. Geborgene Primärquellen & Archäologische Relikte</h2>
          <div class="print-relics-list">
            ${data.relics.map((r, i) => `
              <div class="print-relic-item">
                <span class="relic-num">${i + 1}.</span>
                <div>
                  <strong>${r.title}</strong>
                  <p class="relic-note">📌 <em>${r.note}</em></p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 2. Gefällter Schiedsspruch (Dilemma) -->
        ${data.dilemmaSummary ? `
          <div class="print-section">
            <h2>2. Geschichtlicher Schiedsspruch (Ratsentscheidung)</h2>
            <div class="print-box">
              ${data.dilemmaSummary}
            </div>
          </div>
        ` : ''}

        <!-- 3. Zentrale Fachbegriffe für den Hefter -->
        <div class="print-section">
          <h2>3. Wichtige Fachbegriffe der Epoche</h2>
          <div class="print-terms-grid">
            ${data.keyTerms.slice(0, 3).map(t => `
              <div class="print-term-item">
                <strong>${t.term}:</strong> ${t.definition}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Fußzeile mit Urkunden-Rang -->
        <div class="print-footer">
          <div>Erreichte Auszeichnung: <strong>${data.rankTitle}</strong></div>
          <div>Eingeklebt in den Geschichtshefter am: __________________</div>
        </div>
      </div>
    `;

    document.body.appendChild(sheet);
    this.injectPrintStyles();

    // Druckdialog starten
    window.print();
  }

  private static injectPrintStyles(): void {
    if (document.getElementById('hefter-print-styles')) return;

    const style = document.createElement('style');
    style.id = 'hefter-print-styles';
    style.textContent = `
      #hefter-print-sheet {
        display: none;
      }
      @media print {
        body * {
          visibility: hidden !important;
        }
        #hefter-print-sheet, #hefter-print-sheet * {
          visibility: visible !important;
        }
        #hefter-print-sheet {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: #ffffff !important;
          color: #111827 !important;
          padding: 20px 24px;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 10.5pt;
          line-height: 1.35;
        }
        .print-page {
          max-width: 760px;
          margin: 0 auto;
        }
        .print-header {
          margin-bottom: 10px;
        }
        .print-school-meta {
          font-size: 8.5pt;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .print-title {
          font-size: 15pt;
          font-weight: 800;
          color: #111827;
          margin: 0 0 8px 0;
        }
        .print-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          font-size: 9.5pt;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 6px 10px;
          border-radius: 4px;
        }
        .print-code-box {
          font-family: monospace;
          color: #b45309;
        }
        .print-divider {
          border: none;
          border-top: 1.5px solid #111827;
          margin: 10px 0;
        }
        .print-section {
          margin-bottom: 12px;
          page-break-inside: avoid;
        }
        .print-section h2 {
          font-size: 11pt;
          font-weight: 800;
          text-transform: uppercase;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 3px;
          margin: 0 0 6px 0;
          color: #1f2937;
        }
        .print-relics-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .print-relic-item {
          display: flex;
          gap: 8px;
          font-size: 9.5pt;
        }
        .relic-num {
          font-weight: bold;
          color: #92400e;
        }
        .relic-note {
          margin: 2px 0 0 0;
          color: #374151;
          font-size: 9pt;
        }
        .print-box {
          background: #fefce8;
          border: 1px dashed #ca8a04;
          padding: 8px 12px;
          font-size: 9.5pt;
          color: #713f12;
          border-radius: 4px;
        }
        .print-terms-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .print-term-item {
          font-size: 9pt;
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 3px;
        }
        .print-footer {
          margin-top: 14px;
          padding-top: 8px;
          border-top: 1px solid #9ca3af;
          display: flex;
          justify-content: space-between;
          font-size: 9pt;
          font-weight: 600;
          color: #374151;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
