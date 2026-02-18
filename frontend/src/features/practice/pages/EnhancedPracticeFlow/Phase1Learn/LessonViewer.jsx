
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, BookOpen, FileCode, Lightbulb, Link, CheckCircle2, PlayCircle } from 'lucide-react';
import './LessonViewer.css';

const LessonViewer = ({ module, onClose, onStartQuiz, isCompleted }) => {
  const [activeTab, setActiveTab] = useState('lesson');
  const lessonContent = module.content?.lesson || '';
  const hasHtmlTags = /<[^>]+>/.test(lessonContent);

  return (
    <div className="lesson-viewer">
      <div className="lesson-header">
        <div className="lesson-title-section">
          {/* Note: In a real app, you might map module.icon string to a Lucide icon component mapping */}
          <div className="lesson-icon">{module.icon || <BookOpen size={32} color="#6366F1" />}</div>
          <div>
            <h1 className="lesson-title">{module.title}</h1>
            <p className="lesson-meta">
              <span>{module.estimatedMinutes} minutes</span>
              {isCompleted && (
                <span className="completed-tag">
                  <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Completed
                </span>
              )}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="close-button" aria-label="Close">
          <X size={24} />
        </button>
      </div>

      <div className="lesson-tabs">
        <button className={`tab ${activeTab === 'lesson' ? 'active' : ''} `} onClick={() => setActiveTab('lesson')}>
          <BookOpen size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Lesson
        </button>
        {module.content?.examples?.length > 0 && (
          <button className={`tab ${activeTab === 'examples' ? 'active' : ''} `} onClick={() => setActiveTab('examples')}>
            <FileCode size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Examples
          </button>
        )}
        {module.content?.keyPoints?.length > 0 && (
          <button className={`tab ${activeTab === 'keypoints' ? 'active' : ''} `} onClick={() => setActiveTab('keypoints')}>
            <Lightbulb size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Key Points
          </button>
        )}
        {module.content?.resources?.length > 0 && (
          <button className={`tab ${activeTab === 'resources' ? 'active' : ''} `} onClick={() => setActiveTab('resources')}>
            <Link size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Resources
          </button>
        )}
      </div>

      <div className="lesson-content">
        {activeTab === 'lesson' && (
          <div className="lesson-text">
            {hasHtmlTags ? (
              <div dangerouslySetInnerHTML={{ __html: lessonContent }} />
            ) : (
              <ReactMarkdown>{lessonContent}</ReactMarkdown>
            )}
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="examples-section">
            <h2>Examples</h2>
            {(module.content?.examples || []).map((example, index) => (
              <div key={index} className="example-card">
                <div className="example-number">Example {index + 1}</div>
                <p>{example}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'keypoints' && (
          <div className="keypoints-section">
            <h2>Key Takeaways</h2>
            <ul className="keypoints-list">
              {(module.content?.keyPoints || []).map((point, index) => (
                <li key={index} className="keypoint-item">
                  <span className="keypoint-icon">
                    <CheckCircle2 size={16} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="examples-section">
            <h2>Learning Resources</h2>
            {(module.content?.resources || []).map((resource, index) => (
              <div key={`${resource.url} -${index} `} className="example-card">
                <div className="example-number">{resource.type || 'resource'}</div>
                <p style={{ marginBottom: '0.75rem' }}>
                  <strong>{resource.title}</strong>
                </p>
                {resource.description && <p style={{ marginBottom: '0.75rem' }}>{resource.description}</p>}
                <a href={resource.url} target="_blank" rel="noreferrer" className="btn-start-quiz">
                  Open Resource
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lesson-footer">
        {module.content?.checkpointQuiz?.length > 0 && (
          <div className="quiz-prompt">
            <div className="quiz-info">
              <p className="quiz-text">Test your understanding with a quick quiz ({module.content.checkpointQuiz.length} questions)</p>
              <p className="quiz-note">You need 70% to pass</p>
            </div>
            <button onClick={onStartQuiz} className="btn-start-quiz">
              {isCompleted ? 'Retake Quiz' : 'Take Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonViewer;
