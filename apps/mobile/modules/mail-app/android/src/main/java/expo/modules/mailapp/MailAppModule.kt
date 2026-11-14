package expo.modules.mailapp

import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The inbox, not a draft: Android's email app opened as from the launcher, or its chooser when there are several. */
class MailAppModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun inbox(): Intent =
    Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_EMAIL)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

  override fun definition() = ModuleDefinition {
    Name("MailApp")

    Function("canOpen") {
      context.packageManager.queryIntentActivities(inbox(), 0).isNotEmpty()
    }

    Function("open") {
      context.startActivity(inbox())
    }
  }
}
