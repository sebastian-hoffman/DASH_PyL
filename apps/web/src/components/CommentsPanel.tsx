import React, { useState, useEffect } from "react";

interface Comment {
  id: number;
  file_id: number;
  author: string;
  content: string;
  created_at: string;
}

interface CommentsPanelProps {
  fileId?: number;
  apiBase: string;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  fileId,
  apiBase,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch comments when fileId changes
  useEffect(() => {
    if (!fileId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      try {
        const response = await fetch(`${apiBase}/api/comments?fileId=${fileId}`);
        const data = await response.json();
        setComments(data.comments || []);
      } catch (err) {
        console.error("Error fetching comments:", err);
      }
    };

    void fetchComments();
  }, [fileId, apiBase]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) {
      setError("El comentario no puede estar vacío");
      return;
    }

    if (!fileId) {
      setError("No se especificó archivo");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBase}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          author: author || "anónimo",
          content: newComment,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const data = await response.json();
      setComments([data.comment, ...comments]);
      setNewComment("");
      setAuthor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar comentario");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm("¿Eliminar comentario?")) return;

    try {
      const response = await fetch(`${apiBase}/api/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  if (!fileId) {
    return (
      <div className="comments-panel">
        <p className="muted-hint">Selecciona un archivo para ver comentarios</p>
      </div>
    );
  }

  return (
    <div className="comments-panel">
      <h3>Comentarios ({comments.length})</h3>

      <form onSubmit={handleAddComment} className="comment-form">
        <input
          type="text"
          placeholder="Tu nombre (opcional)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          disabled={loading}
        />
        <textarea
          placeholder="Agregar comentario..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={loading}
          rows={3}
        />
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={loading || !newComment.trim()}>
          {loading ? "Enviando..." : "Comentar"}
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="muted-hint" style={{ marginTop: 12 }}>
          Sin comentarios aún
        </p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <strong>{comment.author}</strong>
                <span className="comment-date">
                  {new Date(comment.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
              <p className="comment-content">{comment.content}</p>
              <button
                type="button"
                className="btn-delete-comment"
                onClick={() => handleDeleteComment(comment.id)}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
