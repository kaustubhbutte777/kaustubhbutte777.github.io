import { useEffect, useRef, useState, useCallback } from 'react';

interface Post {
  slug: string;
  title: string;
  tags: string[];
}

interface TopicGraphProps {
  posts: Post[];
}

interface Node {
  id: string;
  label: string;
  type: 'tag' | 'post';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  connections: string[];
}

export default function TopicGraph({ posts }: TopicGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const animationRef = useRef<number>();

  // Transform state for zoom/pan
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Canvas dimensions
  const canvasWidth = 400;
  const canvasHeight = 300;

  // Initialize nodes
  useEffect(() => {
    if (posts.length === 0) return;

    const tagSet = new Set<string>();
    posts.forEach(p => p.tags?.forEach(t => tagSet.add(t)));
    const tags = Array.from(tagSet);

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Calculate target positions - tags in a circle
    const tagRadius = Math.min(canvasWidth, canvasHeight) * 0.32;
    const tagNodes: Node[] = tags.map((tag, i) => {
      const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
      const targetX = centerX + Math.cos(angle) * tagRadius;
      const targetY = centerY + Math.sin(angle) * tagRadius;

      return {
        id: `tag-${tag}`,
        label: tag,
        type: 'tag' as const,
        // Start from center for animation
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50,
        targetX,
        targetY,
        connections: posts
          .filter(p => p.tags?.includes(tag))
          .map(p => `post-${p.slug}`),
      };
    });

    // Posts positioned near their connected tags
    const postNodes: Node[] = posts.map((post, postIndex) => {
      const connectedTags = tagNodes.filter(t => post.tags?.includes(t.label));

      let targetX = centerX;
      let targetY = centerY;

      if (connectedTags.length > 0) {
        targetX = connectedTags.reduce((sum, t) => sum + t.targetX, 0) / connectedTags.length;
        targetY = connectedTags.reduce((sum, t) => sum + t.targetY, 0) / connectedTags.length;

        // Move towards center
        targetX = targetX + (centerX - targetX) * 0.4;
        targetY = targetY + (centerY - targetY) * 0.4;

        // Add offset using golden angle
        const offsetAngle = (postIndex * 2.39996) % (Math.PI * 2);
        const offsetDist = 15 + (postIndex % 3) * 10;
        targetX += Math.cos(offsetAngle) * offsetDist;
        targetY += Math.sin(offsetAngle) * offsetDist;
      }

      // Clamp to bounds
      targetX = Math.max(50, Math.min(canvasWidth - 50, targetX));
      targetY = Math.max(30, Math.min(canvasHeight - 30, targetY));

      return {
        id: `post-${post.slug}`,
        label: post.title.length > 18 ? post.title.slice(0, 18) + '...' : post.title,
        type: 'post' as const,
        // Start from center for animation
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY + (Math.random() - 0.5) * 80,
        targetX,
        targetY,
        connections: (post.tags || []).map(t => `tag-${t}`),
      };
    });

    nodesRef.current = [...tagNodes, ...postNodes];
  }, [posts]);

  // Animation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodesRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    let isAnimating = true;

    const animate = () => {
      const nodes = nodesRef.current;

      // Smooth animation towards target positions
      let stillMoving = false;
      nodes.forEach(node => {
        const dx = node.targetX - node.x;
        const dy = node.targetY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.5) {
          stillMoving = true;
          // Ease towards target
          node.x += dx * 0.08;
          node.y += dy * 0.08;
        } else {
          node.x = node.targetX;
          node.y = node.targetY;
        }
      });

      // Draw
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();
      ctx.translate(transform.x + canvasWidth / 2, transform.y + canvasHeight / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

      // Draw edges
      nodes.forEach(node => {
        node.connections.forEach(connId => {
          const other = nodes.find(n => n.id === connId);
          if (!other) return;

          const isHighlighted = hoveredNode &&
            (hoveredNode.id === node.id || hoveredNode.id === other.id);

          ctx.strokeStyle = isHighlighted
            ? 'rgba(52, 211, 153, 0.8)'
            : 'rgba(100, 100, 100, 0.35)';
          ctx.lineWidth = isHighlighted ? 1.5 : 0.75;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode?.id === node.id;
        const isConnected = hoveredNode?.connections.includes(node.id) ||
          node.connections.includes(hoveredNode?.id || '');

        let radius = node.type === 'tag' ? 7 : 4;
        if (isHovered) radius += 2;
        else if (isConnected) radius += 1;

        const x = Math.round(node.x);
        const y = Math.round(node.y);

        // Glow effect
        if (isHovered) {
          ctx.shadowColor = node.type === 'tag' ? '#34d399' : '#94a3b8';
          ctx.shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (node.type === 'tag') {
          const postCount = node.connections.length;
          const lightness = 45 + Math.min(postCount / 3, 1) * 15;
          ctx.fillStyle = isHovered ? '#34d399' : isConnected ? '#10b981' : `hsl(160, 65%, ${lightness}%)`;
        } else {
          ctx.fillStyle = isHovered ? '#e2e8f0' : isConnected ? '#94a3b8' : '#64748b';
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        // Labels - always for tags, on hover for posts
        if (node.type === 'tag' || isHovered) {
          const fontSize = node.type === 'tag' ? 9 : 10;
          ctx.font = `${isHovered ? '600' : '500'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Shadow for readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillText(node.label, x + 1, y - radius - 2);

          ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(node.label, x, y - radius - 3);
        }
      });

      ctx.restore();

      // Continue animating if nodes are still moving or if we need to redraw for hover
      if (isAnimating && (stillMoving || hoveredNode)) {
        animationRef.current = requestAnimationFrame(animate);
      } else if (isAnimating) {
        // One more frame after settling
        animationRef.current = requestAnimationFrame(animate);
        isAnimating = false;
      }
    };

    animate();

    return () => {
      isAnimating = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [transform, hoveredNode, posts]);

  // Trigger redraw on hover change
  useEffect(() => {
    if (!animationRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Redraw on hover
      const nodes = nodesRef.current;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      ctx.save();
      ctx.translate(transform.x + canvasWidth / 2, transform.y + canvasHeight / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

      // Draw edges
      nodes.forEach(node => {
        node.connections.forEach(connId => {
          const other = nodes.find(n => n.id === connId);
          if (!other) return;

          const isHighlighted = hoveredNode &&
            (hoveredNode.id === node.id || hoveredNode.id === other.id);

          ctx.strokeStyle = isHighlighted
            ? 'rgba(52, 211, 153, 0.8)'
            : 'rgba(100, 100, 100, 0.35)';
          ctx.lineWidth = isHighlighted ? 1.5 : 0.75;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        });
      });

      // Draw nodes
      nodes.forEach(node => {
        const isHovered = hoveredNode?.id === node.id;
        const isConnected = hoveredNode?.connections.includes(node.id) ||
          node.connections.includes(hoveredNode?.id || '');

        let radius = node.type === 'tag' ? 7 : 4;
        if (isHovered) radius += 2;
        else if (isConnected) radius += 1;

        const x = Math.round(node.x);
        const y = Math.round(node.y);

        if (isHovered) {
          ctx.shadowColor = node.type === 'tag' ? '#34d399' : '#94a3b8';
          ctx.shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);

        if (node.type === 'tag') {
          const postCount = node.connections.length;
          const lightness = 45 + Math.min(postCount / 3, 1) * 15;
          ctx.fillStyle = isHovered ? '#34d399' : isConnected ? '#10b981' : `hsl(160, 65%, ${lightness}%)`;
        } else {
          ctx.fillStyle = isHovered ? '#e2e8f0' : isConnected ? '#94a3b8' : '#64748b';
        }

        ctx.fill();
        ctx.shadowBlur = 0;

        if (node.type === 'tag' || isHovered) {
          const fontSize = node.type === 'tag' ? 9 : 10;
          ctx.font = `${isHovered ? '600' : '500'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillText(node.label, x + 1, y - radius - 2);

          ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
          ctx.fillText(node.label, x, y - radius - 3);
        }
      });

      ctx.restore();
    }
  }, [hoveredNode, transform]);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const x = (screenX - rect.left) * scaleX;
    const y = (screenY - rect.top) * scaleY;

    const canvasX = (x - transform.x - canvasWidth / 2) / transform.scale + canvasWidth / 2;
    const canvasY = (y - transform.y - canvasHeight / 2) / transform.scale + canvasHeight / 2;

    return { x: canvasX, y: canvasY };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;

      setTransform(prev => ({
        ...prev,
        x: prev.x + (e.clientX - dragStart.x) * scaleX,
        y: prev.y + (e.clientY - dragStart.y) * scaleX,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const nodes = nodesRef.current;

    const hovered = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < (node.type === 'tag' ? 14 : 10);
    });

    setHoveredNode(hovered || null);
  }, [isDragging, dragStart, screenToCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredNode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [hoveredNode]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredNode?.type === 'post') {
      const slug = hoveredNode.id.replace('post-', '');
      window.location.href = `/blog/${slug}`;
    } else if (hoveredNode?.type === 'tag') {
      const tag = hoveredNode.label.toLowerCase().replace(/\s+/g, '-');
      window.location.href = `/blog/tags/${tag}`;
    }
  }, [hoveredNode]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Topic Graph
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            (Use scroll wheel to zoom)
          </span>
        </div>
        {transform.scale !== 1 && (
          <button
            onClick={resetView}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Reset view
          </button>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            maxWidth: '100%',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            cursor: isDragging ? 'grabbing' : hoveredNode ? 'pointer' : 'grab'
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
        />

        {transform.scale !== 1 && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white/80">
            {Math.round(transform.scale * 100)}%
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>Tags</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-zinc-500"></div>
            <span>Posts</span>
          </div>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          Click a node to explore
        </span>
      </div>
    </div>
  );
}
