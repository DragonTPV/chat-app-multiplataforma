# Aplicación de Chat en Tiempo Real

## 🚀 Servidor Funcionando

Tu servidor de chat está corriendo en: **http://localhost:3000**

## 📱 Cómo Crear la Aplicación Android (APK)

### Paso 1: Instalar Android Studio

1. Descarga Android Studio desde: https://developer.android.com/studio
2. Instálalo siguiendo las instrucciones

### Paso 2: Crear Nuevo Proyecto

1. Abre Android Studio
2. **File > New > New Project**
3. Selecciona **Empty Activity**
4. Configura:
   - **Name:** ChatApp
   - **Package name:** com.example.chatapp
   - **Language:** Kotlin
   - **Minimum SDK:** API 21 (Android 5.0)

### Paso 3: Agregar Dependencias

Edita el archivo `app/build.gradle` y agrega estas dependencias:

```gradle
dependencies {
    implementation 'io.socket:socket.io-client:2.0.0'
    implementation 'com.squareup.okhttp3:okhttp:4.9.3'
    implementation 'androidx.recyclerview:recyclerview:1.2.1'
    implementation 'androidx.cardview:cardview:1.0.0'
}
```

### Paso 4: Permisos de Internet

Edita `app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Paso 5: Crear las Clases

#### ChatMessage.kt
```kotlin
data class ChatMessage(
    val id: String,
    val username: String,
    val message: String,
    val timestamp: String,
    val isSent: Boolean = false
)
```

#### ChatAdapter.kt
```kotlin
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ChatAdapter(private val messages: MutableList<ChatMessage>) :
    RecyclerView.Adapter<ChatAdapter.MessageViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_1, parent, false)
        return MessageViewHolder(view)
    }

    override fun onBindViewHolder(holder: MessageViewHolder, position: Int) {
        val message = messages[position]
        holder.bind(message)
    }

    override fun getItemCount() = messages.size

    fun addMessage(message: ChatMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }

    class MessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val textView: TextView = itemView.findViewById(android.R.id.text1)

        fun bind(message: ChatMessage) {
            val prefix = if (message.isSent) "Tú: " else "${message.username}: "
            textView.text = "$prefix${message.message}"
        }
    }
}
```

#### MainActivity.kt
```kotlin
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONObject
import java.net.URISyntaxException

class MainActivity : AppCompatActivity() {

    private lateinit var socket: Socket
    private lateinit var chatAdapter: ChatAdapter
    private lateinit var recyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: Button

    private var username = "UsuarioAndroid"
    private var roomName = "sala-general"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        recyclerView = findViewById(R.id.recyclerView)
        messageInput = findViewById(R.id.messageInput)
        sendButton = findViewById(R.id.sendButton)

        chatAdapter = ChatAdapter(mutableListOf())
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = chatAdapter

        try {
            // Cambia la URL si tu servidor está en otro lugar
            socket = IO.socket("http://10.0.2.2:3000") // Para emulador Android
            // socket = IO.socket("http://192.168.1.100:3000") // Para dispositivo real (cambia IP)
        } catch (e: URISyntaxException) {
            e.printStackTrace()
        }

        socket.connect()

        socket.on(Socket.EVENT_CONNECT) {
            runOnUiThread {
                joinRoom()
            }
        }

        socket.on("new-message") { args ->
            runOnUiThread {
                val data = args[0] as JSONObject
                val message = ChatMessage(
                    id = data.getString("id"),
                    username = data.getString("username"),
                    message = data.getString("message"),
                    timestamp = data.getString("timestamp"),
                    isSent = false
                )
                chatAdapter.addMessage(message)
                recyclerView.scrollToPosition(chatAdapter.itemCount - 1)
            }
        }

        sendButton.setOnClickListener {
            val message = messageInput.text.toString().trim()
            if (message.isNotEmpty()) {
                sendMessage(message)
                messageInput.setText("")
            }
        }
    }

    private fun joinRoom() {
        val data = JSONObject()
        data.put("username", username)
        data.put("roomName", roomName)
        socket.emit("join-room", data)
    }

    private fun sendMessage(message: String) {
        val data = JSONObject()
        data.put("message", message)
        data.put("roomName", roomName)
        socket.emit("chat-message", data)

        val chatMessage = ChatMessage(
            id = "",
            username = username,
            message = message,
            timestamp = "",
            isSent = true
        )
        chatAdapter.addMessage(chatMessage)
        recyclerView.scrollToPosition(chatAdapter.itemCount - 1)
    }

    override fun onDestroy() {
        super.onDestroy()
        socket.disconnect()
    }
}
```

### Paso 6: Crear el Layout

Edita `app/src/main/res/layout/activity_main.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Chat en Tiempo Real"
        android:textSize="20sp"
        android:textStyle="bold"
        android:gravity="center"
        android:layout_marginBottom="16dp" />

    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/recyclerView"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginTop="16dp">

        <EditText
            android:id="@+id/messageInput"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:hint="Escribe tu mensaje..."
            android:maxLines="3" />

        <Button
            android:id="@+id/sendButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Enviar" />

    </LinearLayout>

</LinearLayout>
```

### Paso 7: Generar el APK

1. **Build > Build Bundle(s)/APK(s) > Build APK(s)**
2. Espera a que termine el build
3. El APK se guardará en `app/build/outputs/apk/debug/`

### Paso 8: Probar en Dispositivo Real

Para probar en un dispositivo real:
1. Conecta tu teléfono por USB
2. Habilita "USB Debugging" en el teléfono
3. Cambia la URL del socket en el código:
   ```kotlin
   socket = IO.socket("http://[TU_IP_LOCAL]:3000")
   ```
4. Instala el APK en tu teléfono

## 🔧 Configuración del Servidor para Producción

Para usar en producción necesitarás:

1. **VPS o Cloud Server** (DigitalOcean, AWS, etc.)
2. **Dominio y SSL** (Let's Encrypt)
3. **Base de datos** (MongoDB, PostgreSQL)
4. **PM2** para mantener el servidor corriendo

## 📋 Funcionalidades Implementadas

- ✅ Chat en tiempo real con Socket.io
- ✅ Sistema de salas
- ✅ Historial de mensajes
- ✅ Notificaciones de entrada/salida
- ✅ Interfaz web responsive
- ✅ Base para app Android
- ✅ Soporte para múltiples usuarios simultáneos (hasta 100 conexiones)
- ✅ Validación de nombres de usuario únicos
- ✅ Manejo de errores de conexión

¿Necesitas ayuda con algún paso específico o quieres que expanda alguna funcionalidad?

## 🌐 Conexión Remota entre Diferentes Redes

### Cómo Funciona

Para conectar equipos en redes diferentes:

1. **Servidor Local**: Tu servidor corre en `localhost:3000`, solo accesible en tu red local.

2. **Tunneling para Pruebas**: Usa ngrok para crear un túnel seguro que expone tu servidor local a internet.

3. **URL Pública**: ngrok te da una URL como `https://abcd.ngrok.io` que cualquiera puede acceder desde cualquier red.

4. **Conexión**: Los clientes (web y Android) se conectan a esta URL pública en lugar de localhost.

### Configuración para Pruebas Remotas

1. Descarga ngrok desde <https://ngrok.com/download>

2. Descomprime y ejecuta: `ngrok.exe http 3000`

3. Copia la URL de forwarding (ej: https://abcd.ngrok.io)

4. En el código Android, cambia la URL del socket:
   ```kotlin
   socket = IO.socket("https://abcd.ngrok.io")
   ```

5. En el cliente web, accede a https://abcd.ngrok.io en lugar de localhost:3000

### Producción

Para producción, despliega el servidor en la nube:

- **Heroku**: Fácil, pero con límites gratis.
- **DigitalOcean**: VPS económico.
- **Railway**: Similar a Heroku.

Actualiza la URL en el código Android con tu dominio público.
