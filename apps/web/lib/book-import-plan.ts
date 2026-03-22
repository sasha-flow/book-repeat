import type { ImportedSourceBook } from "./sqlite-import";

export interface ExistingBookHashAlias {
  source_hash: string;
  book_id: string;
}

export interface CanonicalBookImportGroup {
  sourceBookIds: number[];
  sourceHashes: string[];
  matchedExistingBookIds: string[];
  winnerBookId: string | null;
  loserBookIds: string[];
  title: string;
  authors: string;
  hasMetadataConflicts: boolean;
}

export interface CanonicalBookImportPlan {
  groups: CanonicalBookImportGroup[];
  sourceBookToGroup: Map<number, number>;
}

function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sortNumbers(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

function addEdge(graph: Map<string, Set<string>>, left: string, right: string) {
  if (!graph.has(left)) {
    graph.set(left, new Set());
  }

  if (!graph.has(right)) {
    graph.set(right, new Set());
  }

  graph.get(left)?.add(right);
  graph.get(right)?.add(left);
}

export function planCanonicalBookImports(
  sourceBooks: ImportedSourceBook[],
  existingAliases: ExistingBookHashAlias[],
): CanonicalBookImportPlan {
  const graph = new Map<string, Set<string>>();
  const sourceBookByNode = new Map<string, ImportedSourceBook>();
  const existingBookIdsByHash = new Map<string, Set<string>>();
  const sourceBookNodesByHash = new Map<string, Set<string>>();

  for (const alias of existingAliases) {
    const bookIds = existingBookIdsByHash.get(alias.source_hash) ?? new Set();
    bookIds.add(alias.book_id);
    existingBookIdsByHash.set(alias.source_hash, bookIds);
  }

  for (const sourceBook of sourceBooks) {
    const sourceNode = `source:${sourceBook.source_book_id}`;

    sourceBookByNode.set(sourceNode, sourceBook);

    if (!graph.has(sourceNode)) {
      graph.set(sourceNode, new Set());
    }

    for (const sourceHash of sourceBook.source_hashes) {
      const sourceNodes = sourceBookNodesByHash.get(sourceHash) ?? new Set();

      for (const peerSourceNode of sourceNodes) {
        addEdge(graph, sourceNode, peerSourceNode);
      }

      sourceNodes.add(sourceNode);
      sourceBookNodesByHash.set(sourceHash, sourceNodes);

      for (const bookId of existingBookIdsByHash.get(sourceHash) ?? []) {
        addEdge(graph, sourceNode, `book:${bookId}`);
      }
    }
  }

  const visited = new Set<string>();
  const groups: CanonicalBookImportGroup[] = [];
  const sourceBookToGroup = new Map<number, number>();

  for (const sourceBook of sourceBooks) {
    const startNode = `source:${sourceBook.source_book_id}`;

    if (visited.has(startNode)) {
      continue;
    }

    const queue = [startNode];
    const componentSourceBooks: ImportedSourceBook[] = [];
    const sourceHashes = new Set<string>();
    const matchedExistingBookIds = new Set<string>();

    visited.add(startNode);

    while (queue.length > 0) {
      const currentNode = queue.shift();

      if (!currentNode) {
        continue;
      }

      if (currentNode.startsWith("source:")) {
        const componentSourceBook = sourceBookByNode.get(currentNode);

        if (componentSourceBook) {
          componentSourceBooks.push(componentSourceBook);

          for (const sourceHash of componentSourceBook.source_hashes) {
            sourceHashes.add(sourceHash);
          }
        }
      } else if (currentNode.startsWith("book:")) {
        matchedExistingBookIds.add(currentNode.slice(5));
      }

      for (const nextNode of graph.get(currentNode) ?? []) {
        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          queue.push(nextNode);
        }
      }
    }

    const sortedSourceBooks = [...componentSourceBooks].sort(
      (left, right) => left.source_book_id - right.source_book_id,
    );
    const representativeSourceBook = sortedSourceBooks[0];
    const titles = new Set(sortedSourceBooks.map((entry) => entry.title));
    const authors = new Set(sortedSourceBooks.map((entry) => entry.authors));
    const sortedExistingBookIds = sortStrings(matchedExistingBookIds);
    const winnerBookId = sortedExistingBookIds[0] ?? null;

    groups.push({
      sourceBookIds: sortNumbers(
        sortedSourceBooks.map((entry) => entry.source_book_id),
      ),
      sourceHashes: sortStrings(sourceHashes),
      matchedExistingBookIds: sortedExistingBookIds,
      winnerBookId,
      loserBookIds:
        winnerBookId === null
          ? []
          : sortedExistingBookIds.filter((bookId) => bookId !== winnerBookId),
      title: representativeSourceBook?.title ?? "",
      authors: representativeSourceBook?.authors ?? "",
      hasMetadataConflicts: titles.size > 1 || authors.size > 1,
    });
  }

  groups.sort(
    (left, right) =>
      (left.sourceBookIds[0] ?? 0) - (right.sourceBookIds[0] ?? 0),
  );

  for (const [groupIndex, group] of groups.entries()) {
    for (const sourceBookId of group.sourceBookIds) {
      sourceBookToGroup.set(sourceBookId, groupIndex);
    }
  }

  return {
    groups,
    sourceBookToGroup,
  };
}