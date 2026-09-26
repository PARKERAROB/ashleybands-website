import { useId } from "react";
import styles from "./DataTable.module.css";

/**
 * A plain accessible table.
 *
 * columns: [{ key, label, align?: "start" | "end", rowHeader?: true }]
 *   rowHeader marks the column that names each row (rendered as <th scope="row">).
 * rows:    array of objects keyed by column key. Values can be strings, numbers or nodes.
 * caption: optional visible caption. Without one, pass `label` so the scroll region has a name.
 * rowKey:  field name or function for React keys (defaults to the row index).
 * empty:   text shown when rows is empty.
 */
export default function DataTable({ columns, rows, caption, label, rowKey, empty = "Nothing to show yet.", className }) {
  const captionId = `table-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const keyFor = (row, index) =>
    typeof rowKey === "function" ? rowKey(row, index) : rowKey ? row[rowKey] : index;
  const regionName = caption ? { "aria-labelledby": captionId } : { "aria-label": label || "Table" };

  return (
    // The wrapper scrolls on narrow screens; tabIndex lets keyboard users scroll it.
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap} role="region" tabIndex={0} {...regionName}>
      <table className={styles.table}>
        {caption ? (
          <caption className={styles.caption} id={captionId}>
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.align === "end" ? styles.end : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={keyFor(row, index)}>
                {columns.map((col) => {
                  const Cell = col.rowHeader ? "th" : "td";
                  return (
                    <Cell
                      key={col.key}
                      scope={col.rowHeader ? "row" : undefined}
                      className={col.align === "end" ? styles.end : undefined}
                    >
                      {row[col.key]}
                    </Cell>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
