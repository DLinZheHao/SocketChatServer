const express = require('express');
// const http = require('http');
const socket = require('socket.io');
const app = express();
const PORT = process.env.PORT || 8080;
const sqlite3 = require('sqlite3').verbose()

const server = app.listen(PORT, () => {
  console.log('開始運行')
})

app.use(express.static('public'))
const io = socket(server);

var count = 0
var userList = []
var typingUsers = {};
var messages = []

// open database in memory
let db = new sqlite3.Database('./messageChat.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the in-memory SQlite database.');
});

// -----------------------------------------------------------------------
// 表的名稱
const tableName = 'messages'; // 替換成你要查看的表的名稱
// 查詢表是否存在
const query = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`;

db.get(query, [], (err, row) => {
  if (err) {
    console.error(err.message);
    return;
  }

  if (!row) {
    // 表不存在，建立表
    const createTableQuery = 
    `
      CREATE TABLE ${tableName} (
        nickname TEXT,
        message TEXT,
        sendTime TEXT
      );
    `

    db.run(createTableQuery, [], (createErr) => {
      if (createErr) {
        console.error(`建立表 '${tableName}' 時發生錯誤：${createErr.message}`);
      } else {
        console.log(`成功建立表 '${tableName}'。`);
      }
    })

  } else {
    console.log(`表 '${tableName}' 已存在。`);
  }
});

// 從資料庫中取出儲存資料
const getDataSql = `SELECT * FROM ${tableName} ORDER BY sendTime ASC;`

db.all(getDataSql, [], (err, rows) => {
  if (err) {
    console.error(`取出資料發生錯誤：${err}`)
  } 
  // 將讀取到的資料裝入 array
  rows.forEach(row => {
    let readMessage = {
      nickname: row.nickname,
      message: row.message,
      sendTime: row.sendTime
    }
    messages.push(readMessage)
  })
})

// -----------------------------------------------------------------------

app.get('/', (req, res) => {
    res.send('這是聊天室測試伺服器')
})

io.on('connection', (socket) => {
  console.log('A user connected to server' + " " +  socket.id)

  socket.on('counter', () => {
    count++
    console.log(count)
    io.emit('counter', count)
  })

  socket.on('loadChatMessage', () => {
    console.log(`傳輸聊天記錄: ${messages}`)
    const messageObject = { messages }
    const result = JSON.stringify(messageObject)
    // console.log(result)
    io.emit('messageLoadding', result)
  })

  socket.on('disconnect', () => {
    console.log(`user ${socket.id} left server`)

    var clientNickname;
    for (var i=0; i<userList.length; i++) {
        if (userList[i]["id"] == socket.id) {
            userList[i]["isConnected"] = false
            clientNickname = userList[i]["nickname"]
            break
        }
    }

    delete typingUsers[clientNickname]
    // 離開後做訊息廣播
    io.emit("userList", userList);
    io.emit("userExitUpdate", clientNickname);
    io.emit("userTypingUpdate", typingUsers);

  })

  socket.on("exitUser", (clientNickname) => {
    console.log(`${clientNickname} was left`)
    for (var i=0; i<userList.length; i++) {
      if (userList[i]["id"] == socket.id) {
        userList.splice(i, 1);
        break;
      }
    }
    io.emit("userExitUpdate", clientNickname);
  });

  // 新訊息輸入
  socket.on('chatMessage', (clientNickname, message) => {
    var currentDateTime = new Date().toLocaleString();
    
    // 預備將訊息存入資料庫中
    const newMessage = {
      nickname: clientNickname,
      message: message,
      sendTime: currentDateTime
    }
    const sql = 'INSERT INTO messages (nickname, message, sendTime) VALUES (?, ?, ?)'
    const params = [newMessage.nickname, newMessage.message, newMessage.sendTime]

    db.run(sql, params, (err) => {
      if (err) {
        console.error(`發生錯誤:${err.message}`)
        return
      }
      console.log(`插入新訊息${this}`)
      messages[message.length] = newMessage 
    })

    // 解除正在輸入人員
    delete typingUsers[clientNickname];
    io.emit("userTypingUpdate", typingUsers);
    io.emit('newChatMessage', newMessage.nickname, newMessage.message, newMessage.sendTime);
  });

  // 使用者連接
  socket.on("connectUser", (clientNickname) => {
      var message = "User " + clientNickname + " was connected.";
      console.log(message);

      var userInfo = {};
      var foundUser = false;
      for (var i=0; i<userList.length; i++) {
        if (userList[i]["nickname"] == clientNickname) {
          userList[i]["isConnected"] = true
          userList[i]["id"] = socket.id;
          userInfo = userList[i];
          foundUser = true;
          break;
        }
      }

      if (!foundUser) {
        userInfo["id"] = socket.id;
        userInfo["nickname"] = clientNickname;
        userInfo["isConnected"] = true
        userList.push(userInfo);
      }

      io.emit("userList", userList);
      io.emit("userConnectUpdate", userInfo)
  });

  // 使用者正在輸入
  socket.on("startType", (clientNickname) => {
    console.log("User " + clientNickname + " is writing a message...");
    typingUsers[clientNickname] = 1;
    io.emit("userTypingUpdate", typingUsers);
  });

  // 使用者停止輸入
  socket.on("stopType", (clientNickname) => {
    console.log("User " + clientNickname + " has stopped writing a message...");
    delete typingUsers[clientNickname];
    io.emit("userTypingUpdate", typingUsers);
  });

});