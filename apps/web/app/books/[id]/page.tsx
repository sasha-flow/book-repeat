import { BookDetailClient } from "../../app-client";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookDetailClient bookId={id} />;
}
