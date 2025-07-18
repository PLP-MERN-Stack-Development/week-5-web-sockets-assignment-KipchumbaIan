import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const REACTIONS = ['👍', '❤️', '😄', '😮', '😢', '😡'];

function App() {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const socketRef = useRef();
  const typingTimeoutRef = useRef();
  const fileInputRef = useRef();

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    
    socketRef.current.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socketRef.current.on('messageReaction', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      ));
    });

    socketRef.current.on('privateMessage', (msg) => {
      setPrivateMessages(prev => [...prev, msg]);
    });

    socketRef.current.on('updateUserList', (userList) => {
      setUsers(userList);
    });

    socketRef.current.on('userTyping', (typingUsers) => {
      setTypingUsers(typingUsers);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        socketRef.current.emit('fileMessage', {
          file: e.target.result,
          fileType: file.type,
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReaction = (messageId, reaction) => {
    const message = messages.find(m => m.id === messageId);
    const hasReacted = message.reactions[reaction]?.includes(username);
    
    if (hasReacted) {
      socketRef.current.emit('removeReaction', { messageId, reaction });
    } else {
      socketRef.current.emit('addReaction', { messageId, reaction });
    }
  };

  const renderMessage = (msg) => {
    return (
      <div key={msg.id} style={{ marginBottom: '10px' }}>
        <div>
          <strong>{msg.user}</strong>: 
          {msg.fileUrl ? (
            msg.fileType.startsWith('image/') ? (
              <img src={msg.fileUrl} alt="shared" style={{ maxWidth: '200px' }} />
            ) : (
              <a href={msg.fileUrl} download={msg.fileName}>{msg.fileName}</a>
            )
          ) : (
            msg.text
          )}
          <small> {msg.time}</small>
        </div>
        <div style={{ marginTop: '5px' }}>
          {REACTIONS.map(reaction => (
            <button
              key={reaction}
              onClick={() => handleReaction(msg.id, reaction)}
              style={{
                margin: '0 5px',
                background: msg.reactions[reaction]?.includes(username) ? '#e0e0e0' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              {reaction} {msg.reactions[reaction]?.length || ''}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    
    // Handle typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    socketRef.current.emit('typing', true);
    
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('typing', false);
    }, 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      if (selectedUser) {
        socketRef.current.emit('privateMessage', {
          to: selectedUser,
          message: message
        });
      } else {
        socketRef.current.emit('chatMessage', message);
      }
      setMessage('');
      socketRef.current.emit('typing', false);
    }
  };

  const setUser = () => {
    if (username.trim()) {
      socketRef.current.emit('setUsername', username);
    }
  };

  return (
    <div className="App">
      {!username ? (
        <div>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            placeholder="Enter username"
          />
          <button onClick={setUser}>Join Chat</button>
        </div>
      ) : (
        <div>
          <h2>Chat Room ({username})</h2>
          <div style={{ display: 'flex' }}>
            <div style={{ width: '200px', padding: '10px' }}>
              <h3>Online Users</h3>
              <ul>
                {users.map((user, i) => (
                  <li 
                    key={i} 
                    onClick={() => setSelectedUser(user === selectedUser ? null : user)}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: user === selectedUser ? '#e0e0e0' : 'transparent'
                    }}
                  >
                    {user}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1, padding: '10px' }}>
              <h3>{selectedUser ? `Private Chat with ${selectedUser}` : 'Global Chat'}</h3>
              <div className="messages" style={{ height: '400px', overflowY: 'auto' }}>
                {(selectedUser ? privateMessages : messages).map(msg => renderMessage(msg))}
              </div>
              {typingUsers.length > 0 && (
                <div style={{ fontSize: '0.8em', color: '#666' }}>
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div style={{ marginTop: '10px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  style={{ marginRight: '10px' }}
                >
                  Share File
                </button>
                <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
                  <input
                    type="text"
                    value={message}
                    onChange={handleMessageChange}
                    placeholder={`Type a message ${selectedUser ? 'to ' + selectedUser : ''}`}
                  />
                  <button type="submit">Send</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;