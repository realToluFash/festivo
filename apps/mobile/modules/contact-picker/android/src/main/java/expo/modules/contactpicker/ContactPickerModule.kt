package expo.modules.contactpicker

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract.CommonDataKinds.Email
import android.provider.ContactsContract.CommonDataKinds.Phone
import android.provider.ContactsContract.CommonDataKinds.StructuredName
import android.provider.ContactsContract.Data
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PICK_ONE = 7579
private const val ASKED = "asked"

/** Android's own checklist needs the Contacts permission; without it, the system picker hands over one number at a time (sc-7579). */
class ContactPickerModule : Module() {
  private var pickingOne: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val prefs
    get() = context.getSharedPreferences("contact-picker", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("ContactPicker")

    Function("asked") { prefs.getBoolean(ASKED, false) }

    Function("allowed") {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("ask") { promise: Promise ->
      prefs.edit().putBoolean(ASKED, true).apply()
      val permissions = appContext.permissions ?: return@AsyncFunction promise.resolve(false)
      permissions.askForPermissions(
        { answers -> promise.resolve(answers[Manifest.permission.READ_CONTACTS]?.status == PermissionsStatus.GRANTED) },
        Manifest.permission.READ_CONTACTS,
      )
    }

    AsyncFunction("list") {
      read(
        Data.CONTENT_URI,
        "${Data.MIMETYPE} IN (?, ?, ?)",
        arrayOf(StructuredName.CONTENT_ITEM_TYPE, Phone.CONTENT_ITEM_TYPE, Email.CONTENT_ITEM_TYPE),
      )
    }

    AsyncFunction("pickOne") { promise: Promise ->
      val activity = appContext.currentActivity ?: return@AsyncFunction promise.resolve(null)
      pickingOne = promise
      activity.startActivityForResult(Intent(Intent.ACTION_PICK, Phone.CONTENT_URI), PICK_ONE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PICK_ONE) return@OnActivityResult
      val promise = pickingOne ?: return@OnActivityResult
      pickingOne = null
      val uri = payload.data?.data
      if (payload.resultCode != Activity.RESULT_OK || uri == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      promise.resolve(read(uri, null, null).firstOrNull())
    }
  }

  /** The phone's own labels are worded by Soirely in its own language; only a label the person wrote is passed on as text. */
  private fun kindOf(type: Int): String = when (type) {
    Phone.TYPE_MOBILE -> "mobile"
    Phone.TYPE_HOME -> "home"
    Phone.TYPE_WORK, Phone.TYPE_WORK_MOBILE -> "work"
    else -> "other"
  }

  /** Only the display name, the numbers and the first email: nothing else of the address book is read. */
  private fun read(uri: Uri, selection: String?, args: Array<String>?): List<Map<String, Any?>> {
    val columns = arrayOf(Data.CONTACT_ID, Data.DISPLAY_NAME_PRIMARY, Data.MIMETYPE, Data.DATA1, Data.DATA2, Data.DATA3)
    val people = LinkedHashMap<Long, Person>()
    context.contentResolver.query(uri, columns, selection, args, "${Data.DISPLAY_NAME_PRIMARY} COLLATE LOCALIZED ASC, ${Data.CONTACT_ID}, ${Data.IS_PRIMARY} DESC, ${Data._ID}")?.use { rows ->
      while (rows.moveToNext()) {
        val person = people.getOrPut(rows.getLong(0)) { Person(rows.getString(1) ?: "") }
        val value = rows.getString(3) ?: continue
        when (rows.getString(2)) {
          StructuredName.CONTENT_ITEM_TYPE -> Unit
          Email.CONTENT_ITEM_TYPE -> if (person.email == null) person.email = value
          Phone.CONTENT_ITEM_TYPE -> {
            val type = rows.getInt(4)
            val label = if (type == Phone.TYPE_CUSTOM) rows.getString(5)?.trim() ?: "" else ""
            person.numbers.add(mapOf("number" to value, "kind" to kindOf(type), "label" to label))
          }
        }
      }
    }

    return people.values.filter { it.name.isNotBlank() }.map { mapOf("name" to it.name, "numbers" to it.numbers, "email" to it.email) }
  }

  private class Person(val name: String) {
    val numbers = mutableListOf<Map<String, Any>>()
    var email: String? = null
  }
}
