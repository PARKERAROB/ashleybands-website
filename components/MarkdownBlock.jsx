function inline(text) {
  const parts = String(text).split(
    /(\*\*\[.*?\]\(.*?\)\*\*|\*\*[^*]+\*\*|`[^`]+`|\[.*?\]\(.*?\))/g
  );
  return parts.map((part, index) => {
    const boldLink = part.match(/^\*\*\[(.*?)\]\((.*?)\)\*\*$/);
    if (boldLink) {
      return (
        <a key={index} href={boldLink[2]} className="cta-link">
          {boldLink[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]}>
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

function splitRow(line) {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

export default function MarkdownBlock({ markdown }) {
  const lines = String(markdown || "").split("\n");
  const blocks = [];
  let list = [];
  let table = [];

  function flushList() {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  }

  function flushTable() {
    if (!table.length) return;
    const isSeparator = (line) =>
      splitRow(line).every((cell) => /^:?-{2,}:?$/.test(cell));
    const rows = table.filter((line) => !isSeparator(line));
    const [headerLine, ...bodyLines] = rows;
    const headers = splitRow(headerLine);
    blocks.push(
      <table key={`table-${blocks.length}`} className="md-table">
        <thead>
          <tr>
            {headers.map((cell, index) => (
              <th key={index}>{inline(cell)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyLines.map((line, rowIndex) => (
            <tr key={rowIndex}>
              {splitRow(line).map((cell, cellIndex) => (
                <td key={cellIndex}>{inline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    table = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("|")) {
      flushList();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line) {
      flushList();
      continue;
    }
    if (line === "---") {
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={blocks.length}>{inline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={blocks.length}>{inline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h1 key={blocks.length}>{inline(line.slice(2))}</h1>);
    } else {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }

  flushTable();
  flushList();

  return <div className="markdown-block">{blocks}</div>;
}
