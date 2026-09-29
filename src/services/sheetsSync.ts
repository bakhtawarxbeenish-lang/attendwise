import { AttendanceSession, AttendanceStatus, CustomField, Student } from '../types';

export const APPS_SCRIPT_CODE = `/**
 * AttendEase — Google Apps Script Backend (Code.gs)
 * Features:
 *   1. Separate "Students" sheet for all student details & custom fields
 *   2. Separate sheet tab automatically created for EVERY Class (Roll No, Student Name, Date headers with P/A/L, Summary)
 *   3. Automatic soft color tones for headers, fields, and conditional P (Green), A (Rose), L (Amber) cells
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var params = (e && e.parameter) ? e.parameter : {};
    var body = {};
    if (method === 'POST' && e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || params.action || 'ping';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = {};

    if (action === 'ping') {
      result = {
        ok: true,
        message: 'AttendEase Apps Script Connected (Color-Toned Students & Per-Class Sheets)',
        sheetName: ss.getName(),
        timestamp: new Date().toISOString()
      };
    } else if (action === 'syncAll' || action === 'saveAttendance') {
      syncAllSheetsWithColors(
        ss,
        body.classes || [],
        body.students || [],
        body.customFields || [],
        body.sessions || []
      );
      result = { ok: true, message: 'Synced Students and all Class sheets with color formatting' };
    } else {
      result = { ok: false, error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err && err.message ? err.message : String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function ensureStyledSheet(ss, name, tabColorHex) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  if (tabColorHex) {
    sheet.setTabColor(tabColorHex);
  }
  return sheet;
}

function syncAllSheetsWithColors(ss, classes, students, customFields, sessions) {
  var sortedFields = (customFields || []).slice().sort(function(a, b) {
    return (a.order || 0) - (b.order || 0);
  });

  var sortedStudents = (students || []).slice().sort(function(a, b) {
    var clsCmp = String(a.className || '').localeCompare(String(b.className || ''));
    if (clsCmp !== 0) return clsCmp;
    return String(a.rollNo || '').localeCompare(String(b.rollNo || ''), undefined, { numeric: true });
  });

  // 1. "Students" Sheet (Separate sheet for student details & custom fields)
  var stSheet = ensureStyledSheet(ss, 'Students', '#5c7cfa');
  var stHeaders = ['Roll No', 'Student Name', 'Class'];
  for (var f = 0; f < sortedFields.length; f++) {
    stHeaders.push(sortedFields[f].name);
  }

  var stRows = [stHeaders];
  for (var i = 0; i < sortedStudents.length; i++) {
    var st = sortedStudents[i];
    var row = [st.rollNo || '', st.name || '', st.className || ''];
    for (var cf = 0; cf < sortedFields.length; cf++) {
      var fid = sortedFields[cf].id;
      row.push((st.customFields && st.customFields[fid]) ? String(st.customFields[fid]) : '');
    }
    stRows.push(row);
  }

  stSheet.clear();
  stSheet.getRange(1, 1, stRows.length, stHeaders.length).setValues(stRows);

  // Style Students Header & Fields
  var stHeaderRange = stSheet.getRange(1, 1, 1, stHeaders.length);
  stHeaderRange.setBackground('#4263eb').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  stSheet.setRowHeight(1, 34);

  if (stHeaders.length > 3) {
    stSheet.getRange(1, 4, 1, stHeaders.length - 3).setBackground('#3b5bdb');
  }
  if (stRows.length > 1) {
    stSheet.getRange(2, 1, stRows.length - 1, 2).setBackground('#f1f5f9').setFontWeight('bold');
    stSheet.getRange(2, 3, stRows.length - 1, stHeaders.length - 2).setBackground('#f8fafc');
  }

  // 2. Separate Sheet for Each Class
  var allClassNames = (classes || []).slice();
  for (var sIdx = 0; sIdx < sortedStudents.length; sIdx++) {
    var cName = sortedStudents[sIdx].className;
    if (cName && allClassNames.indexOf(cName) === -1) allClassNames.push(cName);
  }

  for (var c = 0; c < allClassNames.length; c++) {
    var clsName = allClassNames[c];
    if (!clsName) continue;
    var clsSheet = ensureStyledSheet(ss, clsName.slice(0, 90), '#10b981');
    var clsStudents = sortedStudents.filter(function(item) { return item.className === clsName; });
    var clsSessions = (sessions || []).filter(function(sess) { return sess.className === clsName; });

    var dateSet = {};
    for (var k = 0; k < clsSessions.length; k++) {
      if (clsSessions[k].date) dateSet[clsSessions[k].date] = true;
    }
    var uniqueDates = Object.keys(dateSet).sort();

    var headers = ['Roll No', 'Student Name'].concat(uniqueDates).concat(['Total P', 'Total A', 'Total L', 'Attendance %']);
    var rows = [headers];

    for (var u = 0; u < clsStudents.length; u++) {
      var stu = clsStudents[u];
      var pCount = 0, aCount = 0, lCount = 0;
      var dateCells = [];

      for (var d = 0; d < uniqueDates.length; d++) {
        var dStr = uniqueDates[d];
        var status = '';
        for (var m = 0; m < clsSessions.length; m++) {
          if (clsSessions[m].date === dStr && clsSessions[m].records && clsSessions[m].records[stu.id]) {
            status = clsSessions[m].records[stu.id];
            break;
          }
        }
        dateCells.push(status);
        if (status === 'P') pCount++;
        else if (status === 'A') aCount++;
        else if (status === 'L') lCount++;
      }

      var totalDays = pCount + aCount + lCount;
      var pct = totalDays > 0 ? Math.round((pCount / totalDays) * 100) + '%' : '0%';
      rows.push([stu.rollNo || '', stu.name || ''].concat(dateCells).concat([pCount, aCount, lCount, pct]));
    }

    clsSheet.clear();
    clsSheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    clsSheet.setRowHeight(1, 34);

    // Header color tones
    clsSheet.getRange(1, 1, 1, 2).setBackground('#3b5bdb').setFontColor('#ffffff').setFontWeight('bold');
    if (uniqueDates.length > 0) {
      clsSheet.getRange(1, 3, 1, uniqueDates.length).setBackground('#4c6ef5').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    }
    var summaryStartCol = 3 + uniqueDates.length;
    clsSheet.getRange(1, summaryStartCol, 1, 4).setBackground('#0ca678').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

    if (rows.length > 1) {
      clsSheet.getRange(2, 1, rows.length - 1, 2).setBackground('#f1f5f9').setFontWeight('bold');
      clsSheet.getRange(2, summaryStartCol, rows.length - 1, 4).setBackground('#f0fdf4').setHorizontalAlignment('center').setFontWeight('bold');

      if (uniqueDates.length > 0) {
        var dateRange = clsSheet.getRange(2, 3, rows.length - 1, uniqueDates.length);
        dateRange.setHorizontalAlignment('center').setFontWeight('bold');
        var rules = [
          SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('P').setBackground('#d3f9d8').setFontColor('#1b4332').setRanges([dateRange]).build(),
          SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('A').setBackground('#ffe3e3').setFontColor('#7f1d1d').setRanges([dateRange]).build(),
          SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('L').setBackground('#fff3bf').setFontColor('#78350f').setRanges([dateRange]).build()
        ];
        clsSheet.setConditionalFormatRules(rules);
      }
    }
  }
}
`;

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export async function testAppsScriptConnection(scriptUrl: string): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  try {
    const url = new URL(scriptUrl);
    url.searchParams.set('action', 'ping');
    const res = await fetch(url.toString(), { method: 'GET' });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      return { ok: false, latencyMs, message: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return {
      ok: Boolean(data.ok),
      latencyMs,
      message: data.message || 'Connected to Apps Script Web App',
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      latencyMs,
      message: err?.message || 'Unable to reach Apps Script URL. Ensure it is deployed as "Anyone".',
    };
  }
}

export async function syncSessionViaAppsScript(
  scriptUrl: string,
  session: AttendanceSession,
  students?: Student[],
  customFields?: CustomField[],
  allSessions?: AttendanceSession[],
  classes?: string[]
): Promise<boolean> {
  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'syncAll',
      className: session.className,
      date: session.date,
      records: session.records,
      classes: classes || [],
      students: students || [],
      customFields: customFields || [],
      sessions: allSessions || [session],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Apps Script sync error');
  return true;
}

/**
 * Helper to build Google Sheets API v4 styling requests for a sheet tab:
 * - Soft color-toned header row
 * - Soft tinted student identity columns (Roll No, Name)
 * - Soft tinted custom field / summary columns
 * - Conditional formatting rules for P (Soft Mint), A (Soft Rose), L (Soft Amber)
 */
function buildSheetStyleRequests(
  sheetId: number,
  rowCount: number,
  colCount: number,
  isStudentsTab: boolean,
  dateColCount: number
): any[] {
  const reqs: any[] = [
    // Set header row height to 36px
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 36 },
        fields: 'pixelSize',
      },
    },
    // Set data rows height to 28px
    ...(rowCount > 1
      ? [
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: rowCount,
              },
              properties: { pixelSize: 28 },
              fields: 'pixelSize',
            },
          },
        ]
      : []),
    // Set comfortable width for Roll No (col 0) and Student Name (col 1)
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 105 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 190 },
        fields: 'pixelSize',
      },
    },
    // Base Header Row Styling (Soft Periwinkle Indigo #4263EB with white bold text)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: isStudentsTab
              ? { red: 0.26, green: 0.39, blue: 0.92 }
              : { red: 0.3, green: 0.43, blue: 0.96 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
  ];

  // If Class Attendance sheet, give Summary Headers (Total P, Total A, Total L, Attendance %) a Soft Teal-Emerald header tone
  if (!isStudentsTab && colCount >= 6) {
    const summaryStart = 2 + dateColCount;
    reqs.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: summaryStart,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.08, green: 0.62, blue: 0.52 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });
  }

  // If Students sheet and has Custom Fields (col >= 3), give Custom Field headers a distinct Soft Purple-Indigo tone
  if (isStudentsTab && colCount > 3) {
    reqs.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 3,
          endColumnIndex: colCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.42, green: 0.36, blue: 0.91 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });
  }

  if (rowCount > 1) {
    // Soft background tone for Roll No & Student Name columns (Cols A & B)
    reqs.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
            textFormat: {
              foregroundColor: { red: 0.15, green: 0.2, blue: 0.3 },
              bold: true,
              fontSize: 10,
            },
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
      },
    });

    if (isStudentsTab && colCount > 2) {
      // Soft lavender-tinted field cells for Student Details & Custom Fields
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 2,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.98, green: 0.98, blue: 1.0 },
              textFormat: {
                foregroundColor: { red: 0.2, green: 0.25, blue: 0.35 },
                fontSize: 10,
              },
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)',
        },
      });
    }

    if (!isStudentsTab) {
      // Center align all date cells & summary cells
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 2,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: {
                bold: true,
                fontSize: 10,
              },
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat)',
        },
      });

      // Soft mint tint for the Summary Totals block on the right
      const summaryStart = 2 + dateColCount;
      reqs.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: summaryStart,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.99, blue: 0.96 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: {
                foregroundColor: { red: 0.08, green: 0.35, blue: 0.25 },
                bold: true,
                fontSize: 10,
              },
            },
          },
          fields:
            'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
        },
      });

      // Conditional Formatting Rules for Date Columns: P (Soft Green), A (Soft Rose), L (Soft Amber)
      if (dateColCount > 0) {
        const dateGridRange = {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 2,
          endColumnIndex: 2 + dateColCount,
        };

        reqs.push(
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [dateGridRange],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'P' }],
                  },
                  format: {
                    backgroundColor: { red: 0.83, green: 0.98, blue: 0.85 },
                    textFormat: {
                      foregroundColor: { red: 0.08, green: 0.38, blue: 0.18 },
                      bold: true,
                    },
                  },
                },
              },
              index: 0,
            },
          },
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [dateGridRange],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'A' }],
                  },
                  format: {
                    backgroundColor: { red: 1.0, green: 0.89, blue: 0.89 },
                    textFormat: {
                      foregroundColor: { red: 0.6, green: 0.11, blue: 0.11 },
                      bold: true,
                    },
                  },
                },
              },
              index: 1,
            },
          },
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [dateGridRange],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'L' }],
                  },
                  format: {
                    backgroundColor: { red: 1.0, green: 0.95, blue: 0.75 },
                    textFormat: {
                      foregroundColor: { red: 0.55, green: 0.25, blue: 0.04 },
                      bold: true,
                    },
                  },
                },
              },
              index: 2,
            },
          }
        );
      }
    }
  }

  return reqs;
}

/**
 * Creates a new Google Spreadsheet with:
 *   - "Students" tab (for all student details & custom fields)
 *   - One dedicated sheet tab for EVERY Class (or a default "Attendance" tab if no classes exist yet)
 */
export async function createAttendEaseSpreadsheet(
  accessToken: string,
  classes: string[],
  students: Student[],
  customFields: CustomField[],
  sessions: AttendanceSession[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const discoveredClasses = Array.from(
    new Set([
      ...classes,
      ...students.map((s) => s.className).filter(Boolean),
      ...sessions.map((s) => s.className).filter(Boolean),
    ])
  );

  const classTabs =
    discoveredClasses.length > 0 ? discoveredClasses : ['Attendance'];

  const sheetTabs = [
    {
      properties: {
        title: 'Students',
        gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 },
        tabColorStyle: { rgbColor: { red: 0.36, green: 0.49, blue: 0.98 } },
      },
    },
    ...classTabs.map((cls) => ({
      properties: {
        title: cls.slice(0, 90),
        gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 },
        tabColorStyle: { rgbColor: { red: 0.06, green: 0.73, blue: 0.51 } },
      },
    })),
  ];

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: 'AttendEase — Students & Class Attendance' },
      sheets: sheetTabs,
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to create Google Sheet (${createRes.status})`);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId as string;
  const spreadsheetUrl = created.spreadsheetUrl as string;

  await syncAllToGoogleSheets(
    accessToken,
    spreadsheetId,
    classes,
    students,
    customFields,
    sessions
  );
  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Syncs data AND applies soft color tones to:
 *   1. "Students" tab (Roll No, Student Name, Class, and all Custom Detail Fields)
 *   2. Every Class tab (Roll No, Student Name, Date columns across top header with P/A/L, and Summary Totals)
 */
export async function syncAllToGoogleSheets(
  accessToken: string,
  rawSpreadsheetId: string,
  classes: string[],
  students: Student[],
  customFields: CustomField[],
  sessions: AttendanceSession[]
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetId);
  if (!spreadsheetId) throw new Error('Missing Spreadsheet ID');

  // Discover all active classes so every new class automatically gets its own sheet tab
  const allClasses = Array.from(
    new Set([
      ...classes,
      ...students.map((s) => s.className).filter(Boolean),
      ...sessions.map((s) => s.className).filter(Boolean),
    ])
  );
  const targetClassTabs = allClasses.length > 0 ? allClasses : ['Attendance'];

  // 1. Fetch spreadsheet metadata to check existing sheet tabs and their sheetIds
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const errData = await metaRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Cannot read Google Sheet (${metaRes.status})`);
  }

  const meta = await metaRes.json();
  const existingSheets: Array<{ sheetId: number; title: string }> = (meta.sheets || [])
    .map((s: any) => ({
      sheetId: s?.properties?.sheetId,
      title: s?.properties?.title,
    }))
    .filter((s: any) => typeof s.sheetId === 'number' && Boolean(s.title));

  const existingTitleToId = new Map<string, number>(
    existingSheets.map((s) => [s.title, s.sheetId])
  );

  const requiredTabs = ['Students', ...targetClassTabs.map((c) => c.slice(0, 90))];
  const missingTabs = requiredTabs.filter((t) => !existingTitleToId.has(t));

  const structuralRequests: any[] = missingTabs.map((title) => ({
    addSheet: {
      properties: {
        title,
        gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 },
        tabColorStyle: {
          rgbColor:
            title === 'Students'
              ? { red: 0.36, green: 0.49, blue: 0.98 }
              : { red: 0.06, green: 0.73, blue: 0.51 },
        },
      },
    },
  }));

  // Remove default "Sheet1" if present
  const sheet1Obj = existingSheets.find((s) => s.title === 'Sheet1');
  if (sheet1Obj && existingSheets.length + missingTabs.length > 1) {
    structuralRequests.push({
      deleteSheet: { sheetId: sheet1Obj.sheetId },
    });
  }

  if (structuralRequests.length > 0) {
    const batchAddRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: structuralRequests }),
      }
    );
    if (batchAddRes.ok) {
      const addData = await batchAddRes.json().catch(() => ({}));
      for (const reply of addData.replies || []) {
        const prop = reply?.addSheet?.properties;
        if (prop && typeof prop.sheetId === 'number' && prop.title) {
          existingTitleToId.set(prop.title, prop.sheetId);
        }
      }
    }
  }

  // Clear all target tabs before writing fresh data
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: requiredTabs.map((t) => `'${t.replace(/'/g, "''")}'!A1:ZZ5000`),
      }),
    }
  ).catch(() => {});

  // 2. Build Data Payloads + Color Formatting Requests
  const sortedFields = [...customFields].sort((a, b) => a.order - b.order);
  const sortedStudents = [...students].sort((a, b) => {
    const clsCmp = a.className.localeCompare(b.className);
    if (clsCmp !== 0) return clsCmp;
    return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
  });

  // TAB 1: "Students" (Separate sheet for student details & custom fields)
  const studentHeaders = [
    'Roll No',
    'Student Name',
    'Class',
    ...sortedFields.map((f) => f.name),
  ];
  const studentRows: string[][] = [
    studentHeaders,
    ...sortedStudents.map((st) => [
      st.rollNo,
      st.name,
      st.className,
      ...sortedFields.map((f) => st.customFields[f.id] || ''),
    ]),
  ];

  const dataPayloads: Array<{ range: string; values: string[][] }> = [
    { range: `'Students'!A1`, values: studentRows },
  ];

  const styleRequests: any[] = [];
  const studentsSheetId = existingTitleToId.get('Students');
  if (typeof studentsSheetId === 'number') {
    styleRequests.push(
      ...buildSheetStyleRequests(
        studentsSheetId,
        studentRows.length,
        studentHeaders.length,
        true,
        0
      )
    );
  }

  // TABS 2..N: One Sheet Tab per Class
  for (const rawCls of targetClassTabs) {
    const tabTitle = rawCls.slice(0, 90);
    const classStudents = sortedStudents.filter((s) =>
      allClasses.length > 0 ? s.className === rawCls : true
    );
    const classSessions = sessions.filter((sess) =>
      allClasses.length > 0 ? sess.className === rawCls : true
    );

    const uniqueDates = Array.from(new Set(classSessions.map((s) => s.date))).sort();
    const dateStatusMap = new Map<string, Record<string, AttendanceStatus>>();
    for (const sess of classSessions) {
      const prev = dateStatusMap.get(sess.date) || {};
      dateStatusMap.set(sess.date, { ...prev, ...sess.records });
    }

    const clsHeaders = [
      'Roll No',
      'Student Name',
      ...uniqueDates,
      'Total P',
      'Total A',
      'Total L',
      'Attendance %',
    ];

    const clsRows: string[][] = [clsHeaders];

    for (const st of classStudents) {
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      const dateCells: string[] = [];

      for (const d of uniqueDates) {
        const recForDate = dateStatusMap.get(d) || {};
        const status = recForDate[st.id] || '';
        dateCells.push(status);
        if (status === 'P') pCount++;
        else if (status === 'A') aCount++;
        else if (status === 'L') lCount++;
      }

      const totalDays = pCount + aCount + lCount;
      const pct = totalDays > 0 ? `${Math.round((pCount / totalDays) * 100)}%` : '0%';

      clsRows.push([
        st.rollNo,
        st.name,
        ...dateCells,
        String(pCount),
        String(aCount),
        String(lCount),
        pct,
      ]);
    }

    dataPayloads.push({
      range: `'${tabTitle.replace(/'/g, "''")}'!A1`,
      values: clsRows,
    });

    const clsSheetId = existingTitleToId.get(tabTitle);
    if (typeof clsSheetId === 'number') {
      styleRequests.push(
        ...buildSheetStyleRequests(
          clsSheetId,
          clsRows.length,
          clsHeaders.length,
          false,
          uniqueDates.length
        )
      );
    }
  }

  // 3. Write all values
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataPayloads,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || 'Failed to write values to Google Sheet');
  }

  // 4. Apply Color Tones, Header Formatting & P/A/L Conditional Formatting
  if (styleRequests.length > 0) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: styleRequests }),
      }
    ).catch(() => {});
  }
}
