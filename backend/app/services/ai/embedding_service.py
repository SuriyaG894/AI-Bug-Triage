import os
import numpy as np
from typing import List, Optional

_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from fastembed import TextEmbedding
            _model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
        except ImportError as e:
            print(f"fastembed not installed: {e}")
            _model = None
    return _model


def generate_embedding(text: str) -> Optional[List[float]]:
    """Generate semantic embedding using fastembed (all-MiniLM-L6-v2).
    
    Returns a 384-dimensional dense vector representing the semantic
    meaning of the input text. Returns None if fastembed is not installed.
    """
    if not text or not text.strip():
        text = "unknown"
    
    # Strip HTML tags to avoid semantic embedding distortion
    import re
    text = re.sub(r"<[^>]+>", " ", text)
    
    model = get_model()
    if model is None:
        return None
    
    try:
        embedding = list(model.embed([text.strip()]))[0]
        return embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding)
    except Exception as e:
        print(f"Embedding generation error: {e}")
        return None


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not a or not b:
        return 0.0
    
    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = sum(x * x for x in a) ** 0.5
    magnitude_b = sum(x * x for x in b) ** 0.5
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
    
    return dot_product / (magnitude_a * magnitude_b)