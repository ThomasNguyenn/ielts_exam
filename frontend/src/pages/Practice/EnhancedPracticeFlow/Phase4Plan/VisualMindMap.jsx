import React, { useState } from 'react';
import './VisualMindMap.css';

const VisualMindMap = ({ outline, onOutlineChange, essayStructure }) => {
    const [nodes, setNodes] = useState(() => initializeNodes(outline, essayStructure));
    const [draggedNode, setDraggedNode] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    function initializeNodes(outline, structure) {
        const initialNodes = [];
        let yPosition = 100;

        // Central topic node
        initialNodes.push({
            id: 'topic',
            type: 'topic',
            title: 'Essay Topic',
            content: '',
            x: 400,
            y: 50,
            color: '#d03939'
        });

        // Create nodes for each section
        Object.keys(structure).forEach((sectionKey, index) => {
            const section = structure[sectionKey];
            const xPosition = 150 + (index % 2) * 500;

            initialNodes.push({
                id: sectionKey,
                type: 'section',
                title: section.label,
                content: outline[sectionKey] || '',
                x: xPosition,
                y: yPosition,
                color: getSectionColor(index),
                tips: section.tips
            });

            yPosition += 180;
        });

        return initialNodes;
    }

    function getSectionColor(index) {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        return colors[index % colors.length];
    }

    const handleDragStart = (e, node) => {
        setDraggedNode(node);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!draggedNode) return;

        const container = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - container.left;
        const y = e.clientY - container.top;

        setNodes(prevNodes =>
            prevNodes.map(node =>
                node.id === draggedNode.id
                    ? { ...node, x, y }
                    : node
            )
        );

        setDraggedNode(null);
    };

    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };

    const handleContentChange = (nodeId, content) => {
        setNodes(prevNodes =>
            prevNodes.map(node =>
                node.id === nodeId
                    ? { ...node, content }
                    : node
            )
        );

        // Update parent outline
        if (nodeId !== 'topic') {
            onOutlineChange(nodeId, content);
        }
    };

    const handleAddNote = () => {
        const newNode = {
            id: `note-${Date.now()}`,
            type: 'note',
            title: 'Note',
            content: '',
            x: 400,
            y: 300,
            color: '#fbbf24'
        };
        setNodes(prev => [...prev, newNode]);
    };

    const handleDeleteNode = (nodeId) => {
        if (nodeId === 'topic') return; // Can't delete topic
        setNodes(prev => prev.filter(node => node.id !== nodeId));
        if (selectedNode?.id === nodeId) {
            setSelectedNode(null);
        }
    };

    const drawConnections = () => {
        const topicNode = nodes.find(n => n.id === 'topic');
        if (!topicNode) return null;

        return nodes
            .filter(n => n.type === 'section')
            .map(node => {
                const startX = topicNode.x + 100;
                const startY = topicNode.y + 40;
                const endX = node.x + 100;
                const endY = node.y + 20;

                // Calculate control points for curved line
                const midX = (startX + endX) / 2;
                const curve = `M ${startX} ${startY} Q ${midX} ${startY}, ${midX} ${(startY + endY) / 2} T ${endX} ${endY}`;

                return (
                    <path
                        key={`connection-${node.id}`}
                        d={curve}
                        stroke={node.color}
                        strokeWidth="2"
                        fill="none"
                        opacity="0.3"
                    />
                );
            });
    };

    return (
        <div className="visual-mind-map">
            <div className="mind-map-toolbar">
                <button className="tool-btn" onClick={handleAddNote}>
                    ➕ Add Note
                </button>
                <div className="tool-info">
                    💡 Drag nodes to organize • Click to edit
                </div>
            </div>

            <div
                className="mind-map-canvas"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* SVG for connections */}
                <svg className="mind-map-connections">
                    {drawConnections()}
                </svg>

                {/* Nodes */}
                {nodes.map(node => (
                    <div
                        key={node.id}
                        className={`mind-map-node ${node.type} ${selectedNode?.id === node.id ? 'selected' : ''}`}
                        style={{
                            left: node.x,
                            top: node.y,
                            borderColor: node.color
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node)}
                        onClick={() => handleNodeClick(node)}
                    >
                        <div className="node-header" style={{ background: node.color }}>
                            <span className="node-title">{node.title}</span>
                            {node.type !== 'topic' && (
                                <button
                                    className="node-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteNode(node.id);
                                    }}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <div className="node-body">
                            {node.type === 'topic' ? (
                                <div className="topic-icon">📝</div>
                            ) : (
                                <textarea
                                    className="node-content"
                                    value={node.content}
                                    onChange={(e) => handleContentChange(node.id, e.target.value)}
                                    placeholder={`Write ${node.title.toLowerCase()}...`}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                        </div>
                        {node.tips && (
                            <div className="node-tip">
                                💡 {node.tips}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detail Panel */}
            {selectedNode && selectedNode.type !== 'topic' && (
                <div className="node-detail-panel">
                    <div className="detail-header">
                        <h4>{selectedNode.title}</h4>
                        <button onClick={() => setSelectedNode(null)}>×</button>
                    </div>
                    <div className="detail-body">
                        <textarea
                            className="detail-textarea"
                            value={selectedNode.content}
                            onChange={(e) => handleContentChange(selectedNode.id, e.target.value)}
                            placeholder={`Develop your ${selectedNode.title.toLowerCase()}...`}
                            rows={8}
                        />
                        {selectedNode.tips && (
                            <div className="detail-tips">
                                <strong>💡 Tips:</strong>
                                <p>{selectedNode.tips}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualMindMap;
