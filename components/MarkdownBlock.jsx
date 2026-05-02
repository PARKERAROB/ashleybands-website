function inline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\[.*?\]\(.*?\))/g);
  return parts.map((part, index) => {
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

export default function MarkdownBlock({ markdown }) {
  const lines = String(markdown || "").split("\n");
  const blocks = [];
  let list = [];

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

  for (const rawLine of lines) {
    const line = rawLine.trim();
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

  flushList();

  return <div className="markdown-block">{blocks}</div>;
}
